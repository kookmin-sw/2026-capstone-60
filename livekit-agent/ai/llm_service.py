"""
LLM 서비스 모듈.

Bedrock Claude 를 호출하여 면접 질문 / 꼬리질문 / 새 주제 질문을 생성한다.
동기식 boto3 호출은 asyncio.to_thread 로 감싸 이벤트 루프를 막지 않는다.

rag/fastapi_server/llm_service.py 를 Agent 프로세스에 직접 이식한 버전.
FastAPI / HTTP 레이어는 제거하고, InterviewSession 을 직접 받아 처리한다.
"""

import asyncio
import json
import logging
import os
from typing import Any

import boto3

from .config import AWS_REGION, KB_TOP_K, KNOWLEDGE_BASE_ID, LLM_MODEL
from .prompts import (
    FIRST_QUESTION_PROMPT,
    FOLLOW_UP_PROMPT,
    INTERVIEWER_SYSTEM_PROMPT,
    NEXT_QUESTION_PROMPT,
)
from .session import InterviewSession

logger = logging.getLogger("livekit-agent.llm")


class LLMService:
    """Bedrock 기반 면접 질문 생성기."""

    def __init__(
        self,
        region: str = AWS_REGION,
        model_id: str = LLM_MODEL,
        kb_id: str = KNOWLEDGE_BASE_ID,
        kb_top_k: int = KB_TOP_K,
    ):
        self.model_id = model_id
        self.kb_id = kb_id
        self.kb_top_k = kb_top_k
        self._runtime = boto3.client("bedrock-runtime", region_name=region)
        self._agent_runtime = boto3.client("bedrock-agent-runtime", region_name=region)

    # ── Public API ─────────────────────────────────────────

    def build_system_prompt(self, job_role: str, resume_text: str) -> str:
        return INTERVIEWER_SYSTEM_PROMPT.format(
            job_role=job_role,
            resume_text=resume_text,
        )

    async def generate_first_question(self, session: InterviewSession) -> dict[str, str]:
        """첫 질문 생성. KB 에서 이력서/직무 관련 자료를 검색해 프롬프트에 주입."""
        reference = await self._retrieve(f"{session.job_role} 면접 질문 {session.resume_text[:200]}")
        prompt = FIRST_QUESTION_PROMPT.format(reference_data=reference)

        result = await self._converse(
            system_prompt=session.system_prompt,
            messages=[{"role": "user", "content": [{"text": prompt}]}],
        )

        session.add_question(result["question"], is_follow_up=False, intent=result["intent"])
        return result

    async def generate_follow_up(
        self, session: InterviewSession, user_answer: str
    ) -> dict[str, str]:
        """꼬리질문 생성. 답변을 기록하고 이전 대화 + 참고 자료를 프롬프트에 주입."""
        session.add_answer(user_answer)

        reference = await self._retrieve(f"{session.job_role} {user_answer[:200]}")
        prompt = FOLLOW_UP_PROMPT.format(reference_data=reference)

        messages = session.get_bedrock_messages()
        messages.append({"role": "user", "content": [{"text": prompt}]})

        result = await self._converse(
            system_prompt=session.system_prompt,
            messages=messages,
        )

        session.add_question(result["question"], is_follow_up=True, intent=result["intent"])
        return result

    async def generate_next_topic(
        self, session: InterviewSession, user_answer: str = ""
    ) -> dict[str, str]:
        """이미 다룬 주제를 피해 새 주제 질문을 생성."""
        if user_answer:
            session.add_answer(user_answer)

        reference = await self._retrieve(
            f"{session.job_role} 면접 질문 {session.resume_text[:200]}"
        )
        prompt = NEXT_QUESTION_PROMPT.format(
            asked_topics=session.get_asked_topics(),
            reference_data=reference,
        )

        messages = session.get_bedrock_messages()
        messages.append({"role": "user", "content": [{"text": prompt}]})

        result = await self._converse(
            system_prompt=session.system_prompt,
            messages=messages,
        )

        session.add_question(result["question"], is_follow_up=False, intent=result["intent"])
        return result

    # ── Private helpers ─────────────────────────────────────

    async def _converse(
        self, system_prompt: str, messages: list[dict]
    ) -> dict[str, str]:
        """Bedrock Converse 호출 후 JSON 파싱. 실패 시 text 만 question 으로 반환."""
        def _call() -> str:
            response = self._runtime.converse(
                modelId=self.model_id,
                system=[{"text": system_prompt}],
                messages=messages,
                inferenceConfig={"temperature": 0.7, "maxTokens": 512},
            )
            return response["output"]["message"]["content"][0]["text"]

        raw = await asyncio.to_thread(_call)
        return _parse_question_json(raw)

    async def _retrieve(self, query: str) -> str:
        """KB 에서 관련 자료 검색. 설정 안 됐으면 안내 문자열 반환."""
        if not self.kb_id:
            return "(참고 자료 없음 - Knowledge Base 미설정)"

        def _call() -> list[dict[str, Any]]:
            resp = self._agent_runtime.retrieve(
                knowledgeBaseId=self.kb_id,
                retrievalQuery={"text": query},
                retrievalConfiguration={
                    "vectorSearchConfiguration": {"numberOfResults": self.kb_top_k}
                },
            )
            return resp.get("retrievalResults", [])

        try:
            results = await asyncio.to_thread(_call)
        except Exception as e:
            logger.warning("KB retrieve 실패: %s", e)
            return "(참고 자료 검색 중 오류 발생)"

        if not results:
            return "(관련 참고 자료를 찾지 못했습니다)"

        parts = []
        for i, item in enumerate(results, 1):
            text = item.get("content", {}).get("text", "")
            if text:
                parts.append(f"[자료 {i}]\n{text[:500]}")
        return "\n\n".join(parts) if parts else "(관련 참고 자료를 찾지 못했습니다)"


def _parse_question_json(raw: str) -> dict[str, str]:
    """LLM 응답 JSON 을 파싱. 실패하면 원문을 question 으로 담는다."""
    try:
        obj = json.loads(raw)
        return {
            "question": obj.get("question", "").strip() or raw.strip(),
            "intent": obj.get("intent", "").strip(),
        }
    except (json.JSONDecodeError, AttributeError):
        return {"question": raw.strip(), "intent": ""}


# ─────────────────────────────────────────────────────────
# Mock 구현 (AWS 자격증명 없이 로컬 테스트용)
# ─────────────────────────────────────────────────────────

class MockLLMService:
    """
    Bedrock 을 호출하지 않는 가짜 LLM 서비스.
    진짜 LLMService 와 같은 async 메서드 시그니처를 가진다.

    - 미리 준비된 샘플 질문을 순환 반환
    - session.history 기록 로직은 실제와 동일하게 유지
    - 약간의 지연(0.3초) 을 섞어 파이프라인 거동 검증에 가깝게 함

    LLM_PROVIDER=mock 환경변수로 활성화한다.
    """

    _FIRST_QUESTIONS = [
        "안녕하세요. 첫 질문 드리겠습니다. 이력서에 작성하신 프로젝트 중 "
        "가장 기술적으로 어려웠던 경험을 설명해 주세요.",
    ]
    _NEXT_QUESTIONS = [
        "다른 주제로 넘어가 볼게요. 데이터베이스 트랜잭션 격리 수준에 대해 설명해 주시겠어요?",
        "다음 질문입니다. 분산 환경에서 캐시 일관성을 어떻게 보장하셨나요?",
        "이번엔 배포 쪽 이야기를 들어보죠. CI/CD 파이프라인을 어떻게 구성하셨나요?",
        "메시지 큐를 써 보신 경험이 있다면, 어떤 상황에서 왜 선택하셨는지 말씀해 주세요.",
    ]
    _FOLLOW_UPS = [
        "방금 말씀하신 부분을 조금 더 구체적으로 설명해 주시겠어요?",
        "그 기술을 선택한 이유와, 다른 대안과 비교했을 때의 장단점은 무엇이었나요?",
    ]

    def __init__(self) -> None:
        self._next_idx = 0
        self._follow_idx = 0
        logger.warning("MockLLMService 사용 중 — 실제 Bedrock 호출 없음")

    def build_system_prompt(self, job_role: str, resume_text: str) -> str:
        return INTERVIEWER_SYSTEM_PROMPT.format(
            job_role=job_role, resume_text=resume_text,
        )

    async def generate_first_question(self, session: InterviewSession) -> dict[str, str]:
        await asyncio.sleep(0.3)
        result = {
            "question": self._FIRST_QUESTIONS[0],
            "intent": "지원자의 주도적 문제 해결 경험 파악 (mock)",
        }
        session.add_question(result["question"], is_follow_up=False, intent=result["intent"])
        return result

    async def generate_follow_up(
        self, session: InterviewSession, user_answer: str
    ) -> dict[str, str]:
        await asyncio.sleep(0.3)
        session.add_answer(user_answer)
        q = self._FOLLOW_UPS[self._follow_idx % len(self._FOLLOW_UPS)]
        self._follow_idx += 1
        result = {"question": q, "intent": "답변 심화 (mock)"}
        session.add_question(result["question"], is_follow_up=True, intent=result["intent"])
        return result

    async def generate_next_topic(
        self, session: InterviewSession, user_answer: str = ""
    ) -> dict[str, str]:
        await asyncio.sleep(0.3)
        if user_answer:
            session.add_answer(user_answer)
        q = self._NEXT_QUESTIONS[self._next_idx % len(self._NEXT_QUESTIONS)]
        self._next_idx += 1
        result = {"question": q, "intent": "새 주제 탐색 (mock)"}
        session.add_question(result["question"], is_follow_up=False, intent=result["intent"])
        return result


def create_llm_service() -> "LLMService | MockLLMService":
    """
    환경변수 LLM_PROVIDER 로 실제 / mock 구현을 스위칭한다.
    - "mock"     : MockLLMService (AWS 없이 로컬 테스트)
    - 그 외(기본) : LLMService (Bedrock 실제 호출)
    """
    provider = os.getenv("LLM_PROVIDER", "bedrock").lower()
    if provider == "mock":
        return MockLLMService()
    return LLMService()
