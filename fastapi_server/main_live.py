"""
AI 모의 면접 FastAPI 서버 (Live - Bedrock Claude 연동).

더미 API를 실제 LLM으로 채운 버전.
기존 main.py(더미)와 동일한 엔드포인트/스키마를 유지한다.

실행:
    python -m uvicorn fastapi_server.main_live:app --reload --port 8000
    (interview-agent 디렉토리에서 실행)
"""

import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from .config import MAX_QUESTIONS
from .llm_service import build_system_prompt, generate_first_question, generate_next_question, generate_report
from .session_store import create_session, get_session


# 1. FastAPI 앱 생성
import os

app = FastAPI(
    title="모의면접 AI 파이프라인 API (Live)",
    root_path=os.getenv("ROOT_PATH", ""),
)

# 2. CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# 3. Pydantic 스키마 (main.py와 동일)
# ---------------------------------------------------------

class InterviewStartRequest(BaseModel):
    job_role: str
    resume_text: str
    interview_config: Optional[dict] = None


class InterviewStartResponse(BaseModel):
    session_id: str
    initial_question: str


class AnswerRequest(BaseModel):
    session_id: str
    user_answer: str
    current_question_id: int


class AnswerResponse(BaseModel):
    next_question: str
    is_tail_question: bool
    interview_status: str


class FeedbackItem(BaseModel):
    question: str
    user_answer: str
    good_point: str
    improvement_point: str
    best_practice: str


class FeedbackReportResponse(BaseModel):
    overall_score: int
    detailed_feedback: List[FeedbackItem]


# ---------------------------------------------------------
# 4. API 엔드포인트 (실제 Bedrock Claude 연동)
# ---------------------------------------------------------

@app.post("/api/v1/interview/start", response_model=InterviewStartResponse)
async def start_interview(request: InterviewStartRequest):
    """이력서와 직무 정보를 받아 세션을 생성하고 첫 질문을 반환합니다."""
    session_id = str(uuid.uuid4())

    # 시스템 프롬프트 생성
    system_prompt = build_system_prompt(
        job_role=request.job_role,
        resume_text=request.resume_text,
    )

    # 세션 생성
    session = create_session(
        session_id=session_id,
        job_role=request.job_role,
        resume_text=request.resume_text,
        system_prompt=system_prompt,
    )

    # Bedrock Claude로 첫 질문 생성
    try:
        first_question = generate_first_question(session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 호출 실패: {str(e)}")

    return InterviewStartResponse(
        session_id=session_id,
        initial_question=first_question,
    )


@app.post("/api/v1/interview/answer", response_model=AnswerResponse)
async def submit_answer(request: AnswerRequest):
    """사용자의 답변을 받고 다음 질문(또는 꼬리질문)을 반환합니다."""
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    if session.is_finished:
        return AnswerResponse(
            next_question="이미 종료된 면접입니다. 리포트를 확인해 주세요.",
            is_tail_question=False,
            interview_status="COMPLETED",
        )

    try:
        result = generate_next_question(session, request.user_answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 호출 실패: {str(e)}")

    return AnswerResponse(
        next_question=result["question"],
        is_tail_question=result["is_follow_up"],
        interview_status=result["interview_status"],
    )


@app.get("/api/v1/interview/{session_id}/report", response_model=FeedbackReportResponse)
async def get_report(session_id: str):
    """종료된 세션의 전체 피드백 리포트를 반환합니다."""
    session = get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    if not session.history:
        raise HTTPException(status_code=400, detail="대화 기록이 없습니다.")

    try:
        report = generate_report(session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"리포트 생성 실패: {str(e)}")

    return FeedbackReportResponse(
        overall_score=report.get("overall_score", 0),
        detailed_feedback=[
            FeedbackItem(**item)
            for item in report.get("detailed_feedback", [])
        ],
    )


@app.get("/health", tags=["health"])
async def health_check():
    """서버 상태 확인."""
    return {"status": "ok", "service": "ai-interview-server", "mode": "live"}
