"""
AI 모의 면접 FastAPI 서버 (Dummy).

자바 메인 서버와 HTTP 통신하기 위한 AI 전용 서버.
현재는 더미 데이터를 반환하는 껍데기 상태.

실행:
    uvicorn fastapi_server.main:app --reload --port 8000
    (interview-agent 디렉토리에서 실행)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid


# 1. FastAPI 앱 생성
import os

app = FastAPI(
    title="모의면접 AI 파이프라인 API (Dummy)",
    root_path=os.getenv("ROOT_PATH", ""),
)

# 2. CORS 설정 (자바 서버나 프론트엔드에서 호출할 수 있도록 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발 중에는 모두 허용, 운영 시에는 자바 서버 IP만 입력
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# 3. Pydantic 스키마 정의 (요청/응답 데이터 규격)
# ---------------------------------------------------------

# API 1: 면접 시작
class InterviewStartRequest(BaseModel):
    job_role: str
    resume_text: str
    interview_config: Optional[dict] = None


class InterviewStartResponse(BaseModel):
    session_id: str
    initial_question: str


# API 2: 답변 제출 및 꼬리질문
class AnswerRequest(BaseModel):
    session_id: str
    user_answer: str
    current_question_id: int


class AnswerResponse(BaseModel):
    next_question: str
    is_tail_question: bool
    interview_status: str  # "IN_PROGRESS" or "COMPLETED"


# API 3: 결과 리포트
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
# 4. API 엔드포인트 (더미 데이터 반환)
# ---------------------------------------------------------

@app.post("/api/v1/interview/start", response_model=InterviewStartResponse)
async def start_interview(request: InterviewStartRequest):
    """이력서와 직무 정보를 받아 세션을 생성하고 첫 질문을 반환합니다. (더미)"""
    # 실제로는 여기서 RAG 셋업 및 초기 프롬프트를 실행합니다.
    dummy_session_id = str(uuid.uuid4())
    return InterviewStartResponse(
        session_id=dummy_session_id,
        initial_question=(
            f"[{request.job_role} 직무] 지원해주셔서 감사합니다. "
            f"먼저, 이력서에 적어주신 프로젝트 중 가장 기억에 남는 "
            f"트러블슈팅 경험을 말씀해주세요."
        ),
    )


@app.post("/api/v1/interview/answer", response_model=AnswerResponse)
async def submit_answer(request: AnswerRequest):
    """사용자의 답변을 받고 다음 질문(또는 꼬리질문)을 반환합니다. (더미)"""
    # 실제로는 여기서 사용자의 답변을 DB에 저장하고 LLM을 호출합니다.
    # 질문이 5번 진행되면 종료시킨다는 가상의 로직
    if request.current_question_id >= 5:
        return AnswerResponse(
            next_question="수고하셨습니다. 이것으로 모의면접을 마치겠습니다.",
            is_tail_question=False,
            interview_status="COMPLETED",
        )

    return AnswerResponse(
        next_question=(
            "방금 말씀하신 성능 최적화 과정에서, 특별히 그 기술을 선택하신 "
            "이유가 있을까요? (더미 꼬리질문)"
        ),
        is_tail_question=True,
        interview_status="IN_PROGRESS",
    )


@app.get("/api/v1/interview/{session_id}/report", response_model=FeedbackReportResponse)
async def get_report(session_id: str):
    """종료된 세션의 전체 피드백 리포트를 반환합니다. (더미)"""
    # 실제로는 DB에서 전체 대화 내용을 가져와 LLM으로 평가 리포트를 생성합니다.
    dummy_feedback = FeedbackItem(
        question="성능 최적화 과정에서 그 기술을 선택한 이유가 있나요?",
        user_answer="그냥 많이 써서 썼습니다.",
        good_point="솔직하게 답변했습니다.",
        improvement_point="기술적 근거가 부족합니다.",
        best_practice=(
            "A 기술은 B 기술에 비해 메모리 점유율이 낮아 "
            "선택했다고 답변하는 것이 좋습니다."
        ),
    )

    return FeedbackReportResponse(
        overall_score=85,
        detailed_feedback=[dummy_feedback],
    )
