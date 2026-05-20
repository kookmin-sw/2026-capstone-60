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
import re
from dataclasses import dataclass
from typing import Any

import boto3

from .answer_summarizer import AnswerSummarizer
from .config import (
    AWS_REGION,
    JUDGE_MODEL,
    KB_TOP_K,
    KNOWLEDGE_BASE_ID,
    LLM_MODEL,
    SUMMARY_MODEL,
)
from .prompts import (
    ANSWER_JUDGE_PROMPT,
    FIRST_QUESTION_PROMPT,
    FOLLOW_UP_PROMPT,
    INTERVIEWER_SYSTEM_PROMPT,
    NEXT_QUESTION_PROMPT,
)
from .session import InterviewSession

logger = logging.getLogger("livekit-agent.llm")


@dataclass
class AnswerJudgment:
    extracted_claims: list[str]
    decision: str
    focus_point: str = ""


class LLMService:
    """Bedrock 기반 면접 질문 생성기."""

    def __init__(
        self,
        region: str = AWS_REGION,
        model_id: str = LLM_MODEL,
        summary_model_id: str = SUMMARY_MODEL,
        judge_model_id: str = JUDGE_MODEL,
        kb_id: str = KNOWLEDGE_BASE_ID,
        kb_top_k: int = KB_TOP_K,
    ):
        self.model_id = model_id
        self.summary_model_id = summary_model_id
        self.judge_model_id = judge_model_id
        self.kb_id = kb_id
        self.kb_top_k = kb_top_k
        self._runtime = boto3.client("bedrock-runtime", region_name=region)
        self._agent_runtime = boto3.client("bedrock-agent-runtime", region_name=region)
        self._summarizer = AnswerSummarizer(
            model_id=self.summary_model_id,
            region=region,
        )

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

        session.add_question(
            result["question"],
            is_follow_up=False,
            question_types=result["question_types"],
            turn_number=len(session.history) + 1,
        )
        return result

    async def analyze_last_answer(self, session: InterviewSession) -> AnswerJudgment:
        """마지막 답변을 요약하고, 꼬리질문 필요 여부를 판단한다."""
        if not session.history:
            return AnswerJudgment(extracted_claims=[], decision="NEXT_QUESTION")

        turn = session.history[-1]
        if not turn.answer.strip():
            return AnswerJudgment(extracted_claims=[], decision="NEXT_QUESTION")

        summary = await asyncio.to_thread(self._summarizer.summarize, turn.answer)
        extracted_claims = summary.get("extracted_claims", [])

        # 현재 주제에 대한 연속 꼬리질문 횟수 계산.
        # history[-1]은 현재 답변 턴이므로 제외하고 그 앞을 역순 탐색한다.
        consecutive_follow_ups = 0
        for t in reversed(session.history[:-1]):
            if t.is_follow_up:
                consecutive_follow_ups += 1
            else:
                break

        prompt = ANSWER_JUDGE_PROMPT.format(
            question=turn.question,
            question_types=turn.question_types or "미분류",
            extracted_claims=_format_extracted_claims(extracted_claims),
            consecutive_follow_ups=consecutive_follow_ups,
        )
        raw = await self._converse_text(
            system_prompt="",
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            model_id=self.judge_model_id,
            temperature=0.0,
            max_tokens=256,
        )
        decision, focus_point = _parse_judgment_text(raw)
        logger.info(
            "[analyze_last_answer] consecutive_follow_ups=%d decision=%s focus_point=%s",
            consecutive_follow_ups,
            decision,
            focus_point,
        )
        return AnswerJudgment(
            extracted_claims=extracted_claims,
            decision=decision,
            focus_point=focus_point,
        )

    async def generate_follow_up(
        self, session: InterviewSession, focus_point: str
    ) -> dict[str, str]:
        """판단 결과를 바탕으로 꼬리질문을 생성한다."""
        last_answer = session.history[-1].answer if session.history else ""
        reference = await self._retrieve(
            f"{session.job_role} {focus_point} {last_answer[:200]}"
        )
        prompt = FOLLOW_UP_PROMPT.format(
            focus_point=focus_point,
            reference_data=reference,
        )

        messages = session.get_bedrock_messages()
        messages.append({"role": "user", "content": [{"text": prompt}]})

        result = await self._converse(
            system_prompt=session.system_prompt,
            messages=messages,
        )

        # 최종 부모 찾기: 마지막 턴이 꼬리질문이면 그 부모를 따라감, 원 질문이면 그 턴 번호가 부모
        last_turn = session.history[-1]
        if last_turn.is_follow_up:
            parent = last_turn.parent_turn_number
        else:
            parent = last_turn.turn_number

        session.add_question(
            result["question"],
            is_follow_up=True,
            question_types=result["question_types"],
            parent_turn_number=parent,
            turn_number=len(session.history) + 1,
        )
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

        session.add_question(
            result["question"],
            is_follow_up=False,
            question_types=result["question_types"],
            turn_number=len(session.history) + 1,
        )
        return result

    # ── Private helpers ─────────────────────────────────────

    async def _converse(
        self, system_prompt: str, messages: list[dict]
    ) -> dict[str, str]:
        """Bedrock Converse 호출 후 JSON 파싱. 실패 시 text 만 question 으로 반환."""
        raw = await self._converse_text(
            system_prompt=system_prompt,
            messages=messages,
        )
        return _parse_question_json(raw)

    async def _converse_text(
        self,
        system_prompt: str,
        messages: list[dict],
        model_id: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 512,
    ) -> str:
        def _call() -> str:
            params: dict[str, Any] = {
                "modelId": model_id or self.model_id,
                "messages": messages,
                "inferenceConfig": {
                    "temperature": temperature,
                    "maxTokens": max_tokens,
                },
            }
            if system_prompt.strip():
                params["system"] = [{"text": system_prompt}]
            response = self._runtime.converse(**params)
            return response["output"]["message"]["content"][0]["text"]

        return await asyncio.to_thread(_call)

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
        question_types = obj.get("question_types", [])
        if isinstance(question_types, list):
            qt = ", ".join(question_types)
        else:
            qt = str(question_types).strip()

        return {
            "question": obj.get("question", "").strip() or raw.strip(),
            "question_types": qt,
        }

    except (json.JSONDecodeError, AttributeError):
        return {"question": raw.strip(), "question_types": ""}


def _format_extracted_claims(extracted_claims: list[str]) -> str:
    if not extracted_claims:
        return "(추출된 핵심 내용 없음)"
    return "\n".join(f"- {claim}" for claim in extracted_claims)


def _parse_judgment_text(raw: str) -> tuple[str, str]:
    decision_match = re.search(
        r"DECISION:\s*(FOLLOW_UP|NEXT_QUESTION)",
        raw,
        flags=re.IGNORECASE,
    )
    focus_match = re.search(r"FOCUS_POINT:\s*(.*)", raw, flags=re.IGNORECASE)

    decision = "NEXT_QUESTION"
    if decision_match:
        decision = decision_match.group(1).upper()

    focus_point = ""
    if focus_match:
        focus_point = focus_match.group(1).strip()

    if decision != "FOLLOW_UP":
        return "NEXT_QUESTION", ""

    if not focus_point:
        focus_point = "답변에서 근거와 구체적인 설명이 부족한 부분을 더 확인"
    return decision, focus_point


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
            "question_types": "문제해결력 (mock)",
        }
        session.add_question(
            result["question"],
            is_follow_up=False,
            question_types=result["question_types"],
            turn_number=len(session.history) + 1,
        )
        return result

    async def generate_follow_up(
        self, session: InterviewSession, focus_point: str
    ) -> dict[str, str]:
        await asyncio.sleep(0.3)
        q = self._FOLLOW_UPS[self._follow_idx % len(self._FOLLOW_UPS)]
        self._follow_idx += 1
        result = {
            "question": q,
            "question_types": "기술역량 (mock)",
        }
        # 최종 부모 찾기
        last_turn = session.history[-1]
        if last_turn.is_follow_up:
            parent = last_turn.parent_turn_number
        else:
            parent = last_turn.turn_number
        session.add_question(
            result["question"],
            is_follow_up=True,
            question_types=result["question_types"],
            parent_turn_number=parent,
            turn_number=len(session.history) + 1,
        )
        return result

    async def analyze_last_answer(self, session: InterviewSession) -> AnswerJudgment:
        await asyncio.sleep(0.1)
        if not session.history:
            return AnswerJudgment(extracted_claims=[], decision="NEXT_QUESTION")

        answer = session.history[-1].answer.strip()
        if not answer:
            return AnswerJudgment(extracted_claims=[], decision="NEXT_QUESTION")

        extracted_claims = [answer[:120]]
        unknown_markers = ("모르", "기억이 안", "잘 모르", "생각이 안")
        if any(marker in answer for marker in unknown_markers):
            return AnswerJudgment(
                extracted_claims=extracted_claims,
                decision="NEXT_QUESTION",
            )

        if len(answer) < 50:
            return AnswerJudgment(
                extracted_claims=extracted_claims,
                decision="FOLLOW_UP",
                focus_point="답변이 짧아 근거와 구체적인 설명을 더 확인할 필요가 있음",
            )

        return AnswerJudgment(
            extracted_claims=extracted_claims,
            decision="NEXT_QUESTION",
        )

    async def generate_next_topic(
        self, session: InterviewSession, user_answer: str = ""
    ) -> dict[str, str]:
        await asyncio.sleep(0.3)
        if user_answer:
            session.add_answer(user_answer)
        q = self._NEXT_QUESTIONS[self._next_idx % len(self._NEXT_QUESTIONS)]
        self._next_idx += 1
        result = {"question": q, "question_types": "기술역량 (mock)"}
        session.add_question(
            result["question"],
            is_follow_up=False,
            question_types=result["question_types"],
            turn_number=len(session.history) + 1,
        )
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
