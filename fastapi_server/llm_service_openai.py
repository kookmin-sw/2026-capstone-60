"""
LLM 서비스 모듈 (OpenAI GPT 버전).
OpenAI API를 호출하여 면접 질문 생성, 꼬리질문 판단, 리포트 생성을 수행한다.
"""

import json

from openai import OpenAI

from .config import OPENAI_API_KEY, OPENAI_MODEL, MAX_QUESTIONS, MAX_FOLLOW_UPS
from .prompts import (
    INTERVIEWER_SYSTEM_PROMPT,
    FIRST_QUESTION_PROMPT,
    FOLLOW_UP_PROMPT,
    REPORT_PROMPT,
)
from .session_store import InterviewSession


def _get_client():
    """OpenAI 클라이언트를 생성한다."""
    return OpenAI(api_key=OPENAI_API_KEY)


def build_system_prompt(job_role: str, resume_text: str) -> str:
    """세션용 시스템 프롬프트를 생성한다."""
    return INTERVIEWER_SYSTEM_PROMPT.format(
        job_role=job_role,
        resume_text=resume_text,
        max_questions=MAX_QUESTIONS,
        max_follow_ups=MAX_FOLLOW_UPS,
    )


def generate_first_question(session: InterviewSession) -> str:
    """첫 번째 면접 질문을 생성한다."""
    client = _get_client()

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": session.system_prompt},
            {"role": "user", "content": FIRST_QUESTION_PROMPT},
        ],
        temperature=0.7,
        max_tokens=512,
    )

    question = response.choices[0].message.content
    session.add_question(question, is_follow_up=False)
    return question


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
    session.add_answer(user_answer)

    if session.question_number > MAX_QUESTIONS:
        session.is_finished = True
        return {
            "question": "수고하셨습니다. 이것으로 모의면접을 마치겠습니다.",
            "is_follow_up": False,
            "is_finished": True,
            "interview_status": "COMPLETED",
        }

    client = _get_client()

    # 대화 이력을 OpenAI 메시지 형식으로 변환
    messages = [{"role": "system", "content": session.system_prompt}]
    for turn in session.history:
        messages.append({"role": "assistant", "content": turn.question})
        if turn.answer:
            messages.append({"role": "user", "content": turn.answer})
    messages.append({"role": "user", "content": FOLLOW_UP_PROMPT})

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=messages,
        temperature=0.7,
        max_tokens=512,
    )

    result_text = response.choices[0].message.content

    try:
        result = json.loads(result_text)
        question = result["question"]
        is_follow_up = result.get("is_follow_up", False)
    except (json.JSONDecodeError, KeyError):
        question = result_text
        is_follow_up = False

    if is_follow_up:
        session.follow_up_count += 1
        if session.follow_up_count > MAX_FOLLOW_UPS:
            is_follow_up = False

    if not is_follow_up:
        session.question_number += 1
        session.follow_up_count = 0

    session.add_question(question, is_follow_up=is_follow_up)

    is_finished = session.question_number > MAX_QUESTIONS
    if is_finished:
        session.is_finished = True

    return {
        "question": question,
        "is_follow_up": is_follow_up,
        "is_finished": is_finished,
        "interview_status": "COMPLETED" if is_finished else "IN_PROGRESS",
    }


def generate_report(session: InterviewSession) -> dict:
    """면접 대화 기록을 분석하여 피드백 리포트를 생성한다."""
    client = _get_client()

    conversation_text = session.get_conversation_text()
    prompt = REPORT_PROMPT.format(conversation_history=conversation_text)

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": "기술 면접 평가 전문가로서 JSON 형식으로만 응답하세요."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=2048,
        response_format={"type": "json_object"},
    )

    result_text = response.choices[0].message.content

    try:
        return json.loads(result_text)
    except json.JSONDecodeError:
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
