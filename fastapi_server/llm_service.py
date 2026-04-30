"""
LLM 서비스 모듈.
Bedrock Claude를 호출하여 면접 질문 생성, 꼬리질문 판단, 리포트 생성을 수행한다.
"""

import json

import boto3

from .config import AWS_REGION, LLM_MODEL, KNOWLEDGE_BASE_ID, MAX_QUESTIONS, MAX_FOLLOW_UPS
from .prompts import (
    INTERVIEWER_SYSTEM_PROMPT,
    FIRST_QUESTION_PROMPT,
    FOLLOW_UP_PROMPT,
    REPORT_PROMPT,
)
from .session_store import InterviewSession


def _get_bedrock_client():
    """Bedrock Runtime 클라이언트를 생성한다."""
    return boto3.client("bedrock-runtime", region_name=AWS_REGION)


def _get_bedrock_agent_runtime():
    """Bedrock Agent Runtime 클라이언트를 생성한다."""
    return boto3.client("bedrock-agent-runtime", region_name=AWS_REGION)


def _retrieve_from_kb(query: str, top_k: int = 4) -> str:
    """
    Knowledge Base에서 쿼리와 관련된 자료를 검색한다.
    검색 결과를 텍스트로 조합하여 반환한다.
    KB가 설정되지 않았으면 빈 문자열을 반환한다.
    """
    if not KNOWLEDGE_BASE_ID:
        return "(참고 자료 없음 - Knowledge Base 미설정)"

    try:
        client = _get_bedrock_agent_runtime()
        response = client.retrieve(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            retrievalQuery={"text": query},
            retrievalConfiguration={
                "vectorSearchConfiguration": {
                    "numberOfResults": top_k,
                }
            },
        )

        results = response.get("retrievalResults", [])
        if not results:
            return "(관련 참고 자료를 찾지 못했습니다)"

        parts = []
        for i, item in enumerate(results, 1):
            text = item.get("content", {}).get("text", "")
            if text:
                parts.append(f"[자료 {i}]\n{text[:500]}")

        return "\n\n".join(parts)
    except Exception as e:
        print(f"[KB] 검색 실패: {e}")
        return "(참고 자료 검색 중 오류 발생)"


def build_system_prompt(job_role: str, resume_text: str) -> str:
    """세션용 시스템 프롬프트를 생성한다."""
    return INTERVIEWER_SYSTEM_PROMPT.format(
        job_role=job_role,
        resume_text=resume_text,
        max_questions=MAX_QUESTIONS,
        max_follow_ups=MAX_FOLLOW_UPS,
    )


def generate_first_question(session: InterviewSession) -> dict:
    """
    첫 번째 면접 질문을 생성한다.
    Knowledge Base에서 이력서 기술 스택 관련 자료를 검색하여 참고한다.

    Returns:
        {"question": str, "intent": str}
    """
    client = _get_bedrock_client()

    # KB에서 이력서 관련 면접 자료 검색
    reference_data = _retrieve_from_kb(
        f"{session.job_role} 면접 질문 {session.resume_text[:200]}"
    )

    prompt = FIRST_QUESTION_PROMPT.format(reference_data=reference_data)

    response = client.converse(
        modelId=LLM_MODEL,
        system=[{"text": session.system_prompt}],
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            },
        ],
        inferenceConfig={"temperature": 0.7, "maxTokens": 512},
    )

    result_text = response["output"]["message"]["content"][0]["text"]

    # JSON 파싱 시도
    try:
        result = json.loads(result_text)
        question = result["question"]
        intent = result.get("intent", "")
    except (json.JSONDecodeError, KeyError):
        question = result_text
        intent = ""

    session.add_question(question, is_follow_up=False, intent=intent)
    return {"question": question, "intent": intent}


def generate_next_question(session: InterviewSession, user_answer: str) -> dict:
    """
    답변을 받고 꼬리질문 또는 다음 질문을 생성한다.

    Returns:
        {
            "question": str,
            "is_follow_up": bool,
            "is_finished": bool,
            "interview_status": "IN_PROGRESS" | "COMPLETED"
        }
    """
    # 답변 기록
    session.add_answer(user_answer)

    # 면접 종료 체크
    if session.question_number > MAX_QUESTIONS:
        session.is_finished = True
        return {
            "question": "수고하셨습니다. 이것으로 모의면접을 마치겠습니다.",
            "is_follow_up": False,
            "is_finished": True,
            "interview_status": "COMPLETED",
        }

    client = _get_bedrock_client()

    # KB에서 답변 관련 심화 자료 검색
    reference_data = _retrieve_from_kb(
        f"{session.job_role} {user_answer[:200]}"
    )

    # 대화 이력 + 꼬리질문 판단 요청
    messages = session.get_messages()
    prompt = FOLLOW_UP_PROMPT.format(reference_data=reference_data)
    messages.append({
        "role": "user",
        "content": [{"text": prompt}],
    })

    response = client.converse(
        modelId=LLM_MODEL,
        system=[{"text": session.system_prompt}],
        messages=messages,
        inferenceConfig={"temperature": 0.7, "maxTokens": 512},
    )

    result_text = response["output"]["message"]["content"][0]["text"]

    # JSON 파싱 시도
    try:
        result = json.loads(result_text)
        question = result["question"]
        is_follow_up = result.get("is_follow_up", False)
        intent = result.get("intent", "")
    except (json.JSONDecodeError, KeyError):
        # JSON 파싱 실패 시 텍스트 그대로 사용
        question = result_text
        is_follow_up = False
        intent = ""

    # 꼬리질문 횟수 관리
    if is_follow_up:
        session.follow_up_count += 1
        # 최대 꼬리질문 초과 시 강제로 다음 주제
        if session.follow_up_count > MAX_FOLLOW_UPS:
            is_follow_up = False

    if not is_follow_up:
        session.question_number += 1
        session.follow_up_count = 0

    session.add_question(question, is_follow_up=is_follow_up, intent=intent)

    # 다음 질문 후 종료 체크
    is_finished = session.question_number > MAX_QUESTIONS
    if is_finished:
        session.is_finished = True

    return {
        "question": question,
        "is_follow_up": is_follow_up,
        "is_finished": is_finished,
        "interview_status": "COMPLETED" if is_finished else "IN_PROGRESS",
        "intent": intent,
    }


def generate_report(session: InterviewSession) -> dict:
    """
    면접 대화 기록을 분석하여 피드백 리포트를 생성한다.

    Returns:
        {"overall_score": int, "detailed_feedback": list[dict]}
    """
    client = _get_bedrock_client()

    conversation_text = session.get_conversation_text()
    prompt = REPORT_PROMPT.format(conversation_history=conversation_text)

    response = client.converse(
        modelId=LLM_MODEL,
        system=[{"text": "기술 면접 평가 전문가로서 JSON 형식으로만 응답하세요."}],
        messages=[
            {
                "role": "user",
                "content": [{"text": prompt}],
            },
        ],
        inferenceConfig={"temperature": 0.3, "maxTokens": 2048},
    )

    result_text = response["output"]["message"]["content"][0]["text"]

    try:
        return json.loads(result_text)
    except json.JSONDecodeError:
        # 파싱 실패 시 기본 리포트
        return {
            "overall_score": 0,
            "detailed_feedback": [{
                "question": "리포트 생성 오류",
                "user_answer": "",
                "good_point": "",
                "improvement_point": "LLM 응답을 파싱할 수 없습니다.",
                "best_practice": result_text,
            }],
        }
