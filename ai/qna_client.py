"""
QnA 저장 HTTP 클라이언트.

Agent가 매 턴 종료 시 Backend의 /internal/v1/interviews/sessions/{sessionId}/qnas
엔드포인트로 Q+A를 저장한다.

- 지수 백오프 재시도 (최대 3회)
- fire-and-forget 방식 (NEXT 경로)
- await 방식 (END 경로 — 프로세스 종료 전 반드시 완료)

INTEGRATION_CONTRACT.md §5.5 참조.
"""

import asyncio
import logging
import os

import aiohttp

logger = logging.getLogger("livekit-agent.qna")

# Backend 내부 API base URL
BACKEND_INTERNAL_URL = os.getenv(
    "BACKEND_INTERNAL_URL", "http://localhost:8080"
)

# 서비스 간 통신용 토큰 (배포 시 설정)
SERVICE_TOKEN = os.getenv("SERVICE_TOKEN", "")

# 재시도 설정
MAX_RETRIES = 3
BASE_DELAY = 1.0  # 초


async def save_qna(
    session_id: str,
    turn_number: int,
    question: str,
    intent: str,
    is_follow_up: bool,
    answer: str,
) -> bool:
    """
    단건 QnA를 Backend에 저장한다.

    지수 백오프로 최대 MAX_RETRIES회 재시도.
    성공 시 True, 최종 실패 시 False 반환 (면접 진행은 계속).

    멱등성: Backend가 (sessionId, turnNumber) 유니크 키로 upsert 처리하므로
    같은 턴이 재시도로 두 번 도착해도 안전하다.
    """
    url = f"{BACKEND_INTERNAL_URL}/internal/v1/interviews/sessions/{session_id}/qnas"
    payload = {
        "turnNumber": turn_number,
        "question": question,
        "intent": intent,
        "isFollowUp": is_follow_up,
        "answer": answer,
    }
    headers = {"Content-Type": "application/json"}
    if SERVICE_TOKEN:
        headers["Authorization"] = f"Bearer {SERVICE_TOKEN}"

    for attempt in range(MAX_RETRIES):
        try:
            async with aiohttp.ClientSession() as client:
                async with client.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        logger.info(
                            "[QnA 저장 성공] session=%s turn=%d",
                            session_id, turn_number,
                        )
                        return True
                    else:
                        body = await resp.text()
                        logger.warning(
                            "[QnA 저장 실패] session=%s turn=%d status=%d body=%s (시도 %d/%d)",
                            session_id, turn_number, resp.status, body[:200], attempt + 1, MAX_RETRIES,
                        )
        except Exception as e:
            logger.warning(
                "[QnA 저장 예외] session=%s turn=%d error=%s (시도 %d/%d)",
                session_id, turn_number, e, attempt + 1, MAX_RETRIES,
            )

        if attempt < MAX_RETRIES - 1:
            delay = BASE_DELAY * (2 ** attempt)
            await asyncio.sleep(delay)

    logger.error(
        "[QnA 저장 최종 실패] session=%s turn=%d — 데이터 손실 감수, 면접 계속",
        session_id, turn_number,
    )
    return False
