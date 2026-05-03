"""
AI 모의 면접 FastAPI 서버 (Live - Bedrock Claude 연동).

더미 API를 실제 LLM으로 채운 버전.
기존 main.py(더미)와 동일한 엔드포인트/스키마를 유지한다.

실행:
    python -m uvicorn fastapi_server.main:app --reload --port 8000
    (interview-agent 디렉토리에서 실행)
"""

import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from .llm_service import build_system_prompt, generate_first_question, generate_follow_up
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
    intent: str = ""  # 출제 의도


class AnswerRequest(BaseModel):
    session_id: str
    user_answer: str


class AnswerResponse(BaseModel):
    follow_up_question: str
    intent: str = ""


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
        result = generate_first_question(session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 호출 실패: {str(e)}")

    return InterviewStartResponse(
        session_id=session_id,
        initial_question=result["question"],
        intent=result["intent"],
    )


@app.post("/api/v1/interview/answer", response_model=AnswerResponse)
async def submit_answer(request: AnswerRequest):
    """사용자의 답변을 받고 꼬리질문을 생성합니다."""
    session = get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    try:
        result = generate_follow_up(session, request.user_answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM 호출 실패: {str(e)}")

    return AnswerResponse(
        follow_up_question=result["question"],
        intent=result.get("intent", ""),
    )


@app.get("/health", tags=["health"])
async def health_check():
    """서버 상태 확인."""
    return {"status": "ok", "service": "ai-interview-server", "mode": "live"}
