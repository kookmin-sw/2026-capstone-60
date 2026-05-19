"""
AI 모의면접 LiveKit Agent.

워커 프로세스 진입점. Spring 백엔드의 dispatch 로 Room 이 배정되면
자식 프로세스에서 `entrypoint()` 가 실행된다.

책임 범위:
- LiveKit 파이프라인(STT/턴감지/TTS) 세팅 — STT/TTS 는 LiveKit Inference 사용
- LLM 호출은 Bedrock 직접 (boto3) — ai/llm_service.py
- 사용자 답변을 요약/판단한 뒤, 생성된 질문을 TTS 로 발화

하지 않는 일:
- HTTP 서버 노출 (Agent 는 Worker 이지 HTTP 서버가 아님)
- DB 저장 (나중에 Spring API 호출로 추가 가능)

실행:
    python agent.py console    # 로컬 터미널에서 음성 대화 테스트
    python agent.py dev        # LiveKit Cloud 에 dev 워커로 연결
    python agent.py start      # 프로덕션 워커
"""

import asyncio
import json
import logging
import os
import uuid
from typing import Any, AsyncIterable

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RoomInputOptions,
    RoomOutputOptions,
    TurnHandlingOptions,
    cli,
    inference,
    llm as llm_types,
)
from livekit.plugins import silero

from ai.llm_service import LLMService, MockLLMService, create_llm_service
from ai.qna_client import save_qna
from ai.session import (
    GroupInterviewSession,
    InterviewSession,
    ParticipantInterviewSession,
)

load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("livekit-agent")
GROUP_START_FALLBACK_SECONDS = float(os.getenv("GROUP_START_FALLBACK_SECONDS", "10"))


# ─────────────────────────────────────────────────────────
# Metadata 로딩 (DISPATCH_CONTRACT.md 스펙)
# ─────────────────────────────────────────────────────────

def _load_metadata(ctx: JobContext) -> dict[str, Any]:
    """우선순위: ctx.job.metadata → DEV_METADATA 환경변수 → 내장 기본값.

    ── resumeText 크기 주의 ──
    현재 설계는 Spring 이 이력서 원문을 metadata 에 통째로 실어 전달한다
    (INTEGRATION_CONTRACT.md §3.3 참고). LiveKit dispatch metadata 는 JSON
    문자열이며 수 KB 이내가 안전하다. 이력서가 10KB 를 넘기 시작하면
    dispatch 실패·지연이 발생할 수 있다.

    [향후 마이그레이션 경로]
    resumeId 만 metadata 로 넘기고 Agent 가 Spring 의
    `GET /v1/resumes/{id}/text` 로 조회하는 방식으로 전환한다.
    무증상으로 질문 품질이 급격히 떨어지면 metadata 가 잘려 전달된 것
    아닌지 먼저 의심한다. (아래 로그의 `resume_len` 필드로 확인)
    """
    raw = ctx.job.metadata or os.getenv("DEV_METADATA") or ""
    if raw.strip():
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error("metadata JSON 파싱 실패: %s", e)

    fallback_session = f"dev-{uuid.uuid4()}"
    logger.warning("metadata 없음 — dev fallback 사용 (sessionId=%s)", fallback_session)
    return {
        "sessionId": fallback_session,
        "jobRole": "BACKEND",
        "resumeText": "Spring Boot 기반 백엔드 3년차. Redis, Kafka, AWS 운영 경험.",
        "coverLetterText": "",
    }


# ─────────────────────────────────────────────────────────
# 면접관 Agent
# ─────────────────────────────────────────────────────────

class InterviewerAgent(Agent):
    """
    면접관 역할 Agent.

    - on_enter: 첫 질문을 생성해 발화
    - llm_node: 기본 LLM 대신 LLMService 호출 → 다음 발화 yield
    - session: 대화 이력을 보유하는 InterviewSession 하나 (프로세스당 1개)
    - Data Message 핸들러: Backend 로부터 NEXT/END 수신 처리
    """

    def __init__(
        self,
        session_id: str,
        job_role: str,
        resume_text: str,
        cover_letter_text: str,
        llm_service: "LLMService | MockLLMService",
    ):
        super().__init__(instructions="")  # LiveKit 기본 LLM 미사용
        self._llm_service = llm_service
        self._speaking = False
        self.interview = InterviewSession(
            session_id=session_id,
            job_role=job_role,
            resume_text=resume_text,
            cover_letter_text=cover_letter_text,
            system_prompt=llm_service.build_system_prompt(job_role, resume_text),
        )

    async def _say(self, text: str) -> None:
        self._speaking = True
        try:
            try:
                await self.session.say(text, allow_interruptions=False)
                return
            except TypeError:
                pass

            try:
                await self.session.say(text, allow_barge_in=False)
                return
            except TypeError:
                pass

            try:
                await self.session.say(text, interruptible=False)
                return
            except TypeError:
                pass

            await self.session.say(text)
        finally:
            self._speaking = False

    async def on_enter(self) -> None:
        """Room 입장 직후: STT 버퍼링 등록 → Data Message 핸들러 등록 → 첫 질문 발화."""

        # ── STT 버퍼링 (§5.3.1) ──
        # VAD 기반 자동 턴 종료를 끈 상태이므로 STT 결과를 Agent가 직접 모아둔다.
        @self.session.on("user_input_transcribed")
        def _on_user_transcribed(ev):
            if self._speaking:
                return
            transcript = getattr(ev, "transcript", "")
            if getattr(ev, "is_final", True) and transcript:
                self.interview.append_to_buffer(transcript)
                logger.info("[STT 확정] %s", transcript)
            else:
                logger.debug("[STT 중간] %s", transcript)

        # ── Data Message 핸들러 등록 (§5.3) ──
        room = self.session.room_io.room

        @room.on("data_received")
        def _on_data_received(packet, *args, **kwargs):
            """Backend → Agent: NEXT / END 메시지 처리."""
            try:
                data = packet.data if hasattr(packet, "data") else packet
                msg = json.loads(
                    data.decode("utf-8") if isinstance(data, bytes) else str(data)
                )
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.warning("Data Message 파싱 실패: %s", e)
                return

            msg_type = msg.get("type", "")
            payload = msg.get("payload", {})

            if msg_type == "NEXT":
                asyncio.ensure_future(self._handle_next(payload))
            elif msg_type == "END":
                asyncio.ensure_future(self._handle_end(payload))
            else:
                logger.debug("알 수 없는 Data Message type: %s", msg_type)

        # ── 첫 질문 생성 및 발화 ──
        try:
            result = await self._llm_service.generate_first_question(self.interview)
        except Exception as e:
            logger.exception("첫 질문 생성 실패: %s", e)
            await self._say(
                "죄송합니다, 면접 준비에 문제가 있습니다. 잠시 후 다시 시도해 주세요."
            )
            return

        logger.info("[첫 질문] %s", result["question"])
        await self._say(result["question"])

        # 첫 질문도 QUESTION publish (§5.4: TTS 재생 완료 후)
        await self._publish_question(result, is_follow_up=False)

    async def _publish_question(self, result: dict, is_follow_up: bool) -> None:
        """QUESTION Data Message를 Room에 publish한다 (§5.4).

        TTS say()가 재생 완료까지 await하므로, 이 메서드는 say() 이후에 호출된다.
        publish 실패는 치명적이지 않으므로 try/except로 감싸고 로그만 남긴다.
        """
        try:
            payload = {
                "type": "QUESTION",
                "payload": {
                    "turnNumber": len(self.interview.history),
                    "text": result["question"],
                    "intent": result.get("intent", ""),
                    "isFollowUp": is_follow_up,
                },
            }
            await self.session.room_io.room.local_participant.publish_data(
                payload=json.dumps(payload).encode("utf-8"),
                reliable=True,
                topic="interview",
            )
            logger.info("[QUESTION publish] turn=%d", len(self.interview.history))
        except Exception as e:
            logger.warning("[QUESTION publish 실패] %s — 음성은 이미 전달됨, 면접 계속", e)

    async def _choose_next_question(self) -> tuple[dict[str, str], bool]:
        """마지막 답변을 요약/판단한 뒤 FOLLOW_UP 또는 NEXT_QUESTION 으로 분기한다."""
        last_turn = self.interview.history[-1] if self.interview.history else None
        if not last_turn:
            return await self._llm_service.generate_next_topic(self.interview), False

        judgment = await self._analyze_last_turn()
        if judgment is None:
            return await self._llm_service.generate_next_topic(self.interview), False

        if judgment.decision == "FOLLOW_UP":
            result = await self._llm_service.generate_follow_up(
                self.interview,
                judgment.focus_point,
            )
            return result, True

        return await self._llm_service.generate_next_topic(self.interview), False


    async def _analyze_last_turn(self):
        """Analyze and cache the latest answer. Returns None if analysis fails."""
        try:
            judgment = await self._llm_service.analyze_last_answer(self.interview)
            self.interview.set_last_turn_analysis(
                answer_summary=judgment.extracted_claims,
                decision=judgment.decision,
                focus_point=judgment.focus_point,
            )
            logger.info(
                "[answer analysis] decision=%s focus_point=%s summary_count=%d",
                judgment.decision,
                judgment.focus_point,
                len(judgment.extracted_claims),
            )
            return judgment
        except Exception as e:
            logger.warning("answer analysis failed: %s; falling back to NEXT_QUESTION", e)
            return None

    async def _handle_next(self, payload: dict) -> None:
        """NEXT 수신: ① STT 버퍼 flush → ② QnA 저장 (fire-and-forget) → ③ 다음 질문 생성·발화 → ④ QUESTION publish.

        §5.3 처리 순서:
        1. STT 버퍼에 누적된 텍스트를 직전 턴에 기록
        2. 직전 턴의 Q+A를 Backend로 저장 (fire-and-forget)
        3. 답변 요약/판단 후 꼬리질문 또는 다음 질문 생성
        4. TTS 발화 → 재생 완료 후 QUESTION 메시지 publish
        """
        turn_number = payload.get("turnNumber", 0)
        logger.info("[NEXT 수신] turnNumber=%d", turn_number)

        # ① STT 버퍼 flush → 직전 턴 답변 기록
        answer = self.interview.flush_buffer()
        self.interview.add_answer(answer)
        logger.info("[답변 확정] turn=%d answer_len=%d", turn_number - 1, len(answer))

        # ② QnA 저장 — fire-and-forget (§5.5)
        prev_turn = self.interview.history[-1] if self.interview.history else None
        prev_turn_number = len(self.interview.history)

        # ③ 다음 질문 생성·발화
        try:
            result, is_follow_up = await self._choose_next_question()
        except Exception as e:
            logger.exception("다음 질문 생성 실패 (NEXT): %s", e)
            await self._say(
                "죄송합니다, 잠시 문제가 생겼습니다. 다음 질문으로 넘어가겠습니다."
            )
            return

        # Store after analysis so answer_summary/decision/focus_point are included.
        if prev_turn:
            asyncio.create_task(save_qna(
                session_id=self.interview.session_id,
                turn_number=prev_turn_number,
                question=prev_turn.question,
                intent=prev_turn.intent,
                is_follow_up=prev_turn.is_follow_up,
                answer=prev_turn.answer,
                answer_summary=prev_turn.answer_summary,
                follow_up_decision=prev_turn.decision,
                focus_point=prev_turn.focus_point,
            ))

        logger.info("[다음 질문] turn=%d question=%s", turn_number, result["question"])
        await self._say(result["question"])

        # ④ QUESTION publish — TTS say()가 재생 완료까지 기다리므로 여기서 publish (§5.4)
        await self._publish_question(result, is_follow_up=is_follow_up)

    async def _handle_end(self, payload: dict) -> None:
        """END 수신: ① STT 버퍼 flush → ② 마지막 턴 저장 (await) → ③ shutdown.

        §5.3 처리 순서:
        1. STT 버퍼 내용을 마지막 턴에 기록
        2. 마지막 턴 저장 — await로 기다림 (프로세스 종료 전 반드시 완료)
        3. session.shutdown()
        """
        reason = payload.get("reason", "UNKNOWN")
        logger.info("[END 수신] reason=%s", reason)

        # ① STT 버퍼 flush → 마지막 턴 답변 기록
        answer = self.interview.flush_buffer()
        self.interview.add_answer(answer)
        logger.info("[마지막 답변 확정] answer_len=%d", len(answer))

        # ② 마지막 턴 QnA 저장 — await (§5.5: END 경로는 동기로 기다림)
        last_turn = self.interview.history[-1] if self.interview.history else None
        if last_turn:
            last_turn_number = len(self.interview.history)
            await self._analyze_last_turn()
            await save_qna(
                session_id=self.interview.session_id,
                turn_number=last_turn_number,
                question=last_turn.question,
                intent=last_turn.intent,
                is_follow_up=last_turn.is_follow_up,
                answer=last_turn.answer,
                answer_summary=last_turn.answer_summary,
                follow_up_decision=last_turn.decision,
                focus_point=last_turn.focus_point,
            )

        # ③ shutdown
        logger.info("[면접 종료] session=%s total_turns=%d",
                    self.interview.session_id, len(self.interview.history))
        try:
            self.session.shutdown()
        except RuntimeError:
            pass  # Agent activity가 이미 종료된 경우 무시

    async def llm_node(
        self,
        chat_ctx: llm_types.ChatContext,
        tools: list[Any],
        model_settings: Any,
    ) -> AsyncIterable[str]:
        """
        기본 LLM 노드 오버라이드.
        사용자 답변이 끝날 때마다 호출된다.

        NOTE: 턴 전환은 이제 Backend의 NEXT Data Message로 제어된다.
        이 메서드는 VAD 기반 자동 턴 종료가 비활성화된 상태에서는
        호출되지 않을 수 있다. NEXT 핸들러가 메인 질문 생성 경로.
        기존 호환성을 위해 유지하되, 실제 면접 흐름에서는 _handle_next가 주 경로.
        """
        user_answer = _extract_last_user_text(chat_ctx)
        logger.info("[llm_node 답변 수신] %s", user_answer)

        if not user_answer.strip():
            yield "답변이 제대로 들리지 않았습니다. 다시 말씀해 주시겠어요?"
            return

        try:
            self.interview.add_answer(user_answer)
            result, _ = await self._choose_next_question()
        except Exception as e:
            logger.exception("다음 질문 생성 실패: %s", e)
            yield "죄송합니다, 잠시 문제가 생겼습니다. 다음 질문으로 넘어가겠습니다."
            return

        logger.info("[다음 질문] %s", result["question"])
        yield result["question"]


class GroupInterviewerAgent(Agent):
    """
    그룹 면접 Agent.

    - Backend START 수신 전까지 질문하지 않는다.
    - 라운드마다 참가자 순서를 셔플하고, 한 라운드에 모두 한 번씩 기본 질문을 받는다.
    - 꼬리질문은 같은 참가자에게 최대 1회만 허용한다.
    """

    def __init__(
        self,
        session_id: str,
        job_role: str,
        participants: list[dict[str, Any]],
        fallback_resume_text: str,
        cover_letter_text: str,
        llm_service: "LLMService | MockLLMService",
    ):
        super().__init__(instructions="")
        self._llm_service = llm_service
        self._speaking = False
        self._started = False
        self._start_lock = asyncio.Lock()
        self._fallback_task: asyncio.Task | None = None
        self.group = GroupInterviewSession(
            session_id=session_id,
            job_role=job_role,
            participants=[
                ParticipantInterviewSession(
                    member_id=int(participant["memberId"]),
                    identity=participant["identity"],
                    name=participant.get("name", participant["identity"]),
                    interview=InterviewSession(
                        session_id=session_id,
                        job_role=job_role,
                        resume_text=participant.get("resumeText") or fallback_resume_text,
                        cover_letter_text=cover_letter_text,
                        system_prompt=llm_service.build_system_prompt(
                            job_role,
                            participant.get("resumeText") or fallback_resume_text,
                        ),
                    ),
                )
                for participant in participants
            ],
        )

    async def _say(self, text: str) -> None:
        self._speaking = True
        try:
            try:
                await self.session.say(text, allow_interruptions=False)
                return
            except TypeError:
                pass

            try:
                await self.session.say(text, allow_barge_in=False)
                return
            except TypeError:
                pass

            try:
                await self.session.say(text, interruptible=False)
                return
            except TypeError:
                pass

            await self.session.say(text)
        finally:
            self._speaking = False

    async def on_enter(self) -> None:
        """GROUP: STT/Data 핸들러 등록 후 START 또는 fallback 시작을 기다린다."""

        @self.session.on("user_input_transcribed")
        def _on_user_transcribed(ev):
            if self._speaking or not self._started:
                return
            transcript = getattr(ev, "transcript", "")
            if getattr(ev, "is_final", True) and transcript:
                participant = self.group.current_participant()
                participant.interview.append_to_buffer(transcript)
                logger.info(
                    "[GROUP STT 확정] target=%s text=%s",
                    participant.identity,
                    transcript,
                )
            else:
                logger.debug("[GROUP STT 중간] %s", transcript)

        room = self.session.room_io.room

        @room.on("data_received")
        def _on_data_received(packet, *args, **kwargs):
            try:
                data = packet.data if hasattr(packet, "data") else packet
                msg = json.loads(
                    data.decode("utf-8") if isinstance(data, bytes) else str(data)
                )
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.warning("GROUP Data Message 파싱 실패: %s", e)
                return

            msg_type = msg.get("type", "")
            payload = msg.get("payload", {})

            if msg_type == "START":
                asyncio.ensure_future(self._handle_start(payload))
            elif msg_type == "NEXT":
                asyncio.ensure_future(self._handle_next(payload))
            elif msg_type == "END":
                asyncio.ensure_future(self._handle_end(payload))
            else:
                logger.debug("GROUP 알 수 없는 Data Message type: %s", msg_type)

        self._fallback_task = asyncio.create_task(self._start_after_fallback_delay())

    async def _start_after_fallback_delay(self) -> None:
        await asyncio.sleep(GROUP_START_FALLBACK_SECONDS)
        if self._started:
            return
        logger.warning(
            "[GROUP START fallback] START 미수신 — metadata participants 기준으로 시작"
        )
        await self._start_interview(source="fallback")

    async def _handle_start(self, payload: dict) -> None:
        if self._started:
            logger.info("[GROUP START 무시] 이미 시작됨")
            return

        target_identity = payload.get("targetIdentity")
        logger.info("[GROUP START 수신] targetIdentity=%s", target_identity)
        await self._start_interview(source="start")

    async def _start_interview(self, source: str) -> None:
        async with self._start_lock:
            if self._started:
                return
            if not self.group.participants:
                logger.error("[GROUP 시작 실패] participants 없음")
                return

            self.group.start_new_round()
            self.group.current_turn_number = 1
            self.group.follow_up_active = False
            self._started = True
            logger.info(
                "[GROUP 시작] source=%s round=%d order=%s",
                source,
                self.group.round_number,
                [
                    self.group.participants[index].identity
                    for index in self.group.round_order
                ],
            )
            await self._ask_current_participant(
                turn_number=self.group.current_turn_number,
                is_follow_up=False,
            )

    async def _ask_current_participant(
        self,
        turn_number: int,
        is_follow_up: bool,
        focus_point: str = "",
    ) -> None:
        participant = self.group.current_participant()
        interview = participant.interview

        try:
            if is_follow_up:
                result = await self._llm_service.generate_follow_up(
                    interview,
                    focus_point,
                )
            elif interview.history:
                result = await self._llm_service.generate_next_topic(interview)
            else:
                result = await self._llm_service.generate_first_question(interview)
        except Exception as e:
            logger.exception("GROUP 질문 생성 실패: %s", e)
            await self._say(
                "죄송합니다, 잠시 문제가 생겼습니다. 다음 질문으로 넘어가겠습니다."
            )
            return

        if interview.history:
            interview.history[-1].turn_number = turn_number

        logger.info(
            "[GROUP 질문] turn=%d target=%s follow_up=%s question=%s",
            turn_number,
            participant.identity,
            is_follow_up,
            result["question"],
        )
        await self._say(result["question"])
        await self._publish_question(result, participant, turn_number, is_follow_up)

    async def _publish_question(
        self,
        result: dict,
        participant: ParticipantInterviewSession,
        turn_number: int,
        is_follow_up: bool,
    ) -> None:
        try:
            payload = {
                "type": "QUESTION",
                "payload": {
                    "turnNumber": turn_number,
                    "text": result["question"],
                    "intent": result.get("intent", ""),
                    "isFollowUp": is_follow_up,
                    "targetIdentity": participant.identity,
                },
            }
            await self.session.room_io.room.local_participant.publish_data(
                payload=json.dumps(payload).encode("utf-8"),
                reliable=True,
                topic="interview",
            )
            logger.info(
                "[GROUP QUESTION publish] turn=%d target=%s",
                turn_number,
                participant.identity,
            )
        except Exception as e:
            logger.warning("[GROUP QUESTION publish 실패] %s — 면접 계속", e)

    async def _handle_next(self, payload: dict) -> None:
        if not self._started:
            logger.warning("[GROUP NEXT 무시] 아직 START 전")
            return

        turn_number = int(payload.get("turnNumber") or self.group.current_turn_number + 1)
        if turn_number <= self.group.last_processed_next_turn_number:
            logger.warning("[GROUP NEXT 중복 무시] turnNumber=%d", turn_number)
            return
        self.group.last_processed_next_turn_number = turn_number

        participant = self.group.current_participant()
        interview = participant.interview
        answer = interview.flush_buffer()
        interview.add_answer(answer)
        logger.info(
            "[GROUP 답변 확정] respondent=%s turn=%d answer_len=%d",
            participant.identity,
            self.group.current_turn_number,
            len(answer),
        )

        last_turn = interview.history[-1] if interview.history else None
        judgment = None
        if last_turn:
            judgment = await self._analyze_participant_turn(participant)
            asyncio.create_task(self._save_participant_qna(participant, last_turn))

        should_follow_up = (
            not self.group.follow_up_active
            and judgment is not None
            and judgment.decision == "FOLLOW_UP"
        )

        self.group.current_turn_number = turn_number
        if should_follow_up:
            self.group.follow_up_active = True
            await self._ask_current_participant(
                turn_number=turn_number,
                is_follow_up=True,
                focus_point=judgment.focus_point,
            )
            return

        if self.group.follow_up_active:
            self.group.follow_up_active = False
        self.group.advance_speaker()
        await self._ask_current_participant(turn_number=turn_number, is_follow_up=False)

    async def _handle_end(self, payload: dict) -> None:
        reason = payload.get("reason", "UNKNOWN")
        logger.info("[GROUP END 수신] reason=%s", reason)

        if self._started and self.group.participants:
            participant = self.group.current_participant()
            interview = participant.interview
            answer = interview.flush_buffer()
            interview.add_answer(answer)
            logger.info(
                "[GROUP 마지막 답변 확정] respondent=%s answer_len=%d",
                participant.identity,
                len(answer),
            )

            last_turn = interview.history[-1] if interview.history else None
            if last_turn:
                await self._analyze_participant_turn(participant)
                await self._save_participant_qna(participant, last_turn)

        logger.info("[GROUP 면접 종료] session=%s", self.group.session_id)
        try:
            self.session.shutdown()
        except RuntimeError:
            pass

    async def _analyze_participant_turn(self, participant: ParticipantInterviewSession):
        try:
            judgment = await self._llm_service.analyze_last_answer(participant.interview)
            participant.interview.set_last_turn_analysis(
                answer_summary=judgment.extracted_claims,
                decision=judgment.decision,
                focus_point=judgment.focus_point,
            )
            logger.info(
                "[GROUP answer analysis] respondent=%s decision=%s focus_point=%s",
                participant.identity,
                judgment.decision,
                judgment.focus_point,
            )
            return judgment
        except Exception as e:
            logger.warning(
                "GROUP answer analysis failed respondent=%s: %s",
                participant.identity,
                e,
            )
            return None

    async def _save_participant_qna(
        self,
        participant: ParticipantInterviewSession,
        turn,
    ) -> bool:
        return await save_qna(
            session_id=self.group.session_id,
            turn_number=turn.turn_number or self.group.current_turn_number,
            question=turn.question,
            intent=turn.intent,
            is_follow_up=turn.is_follow_up,
            answer=turn.answer,
            answer_summary=turn.answer_summary,
            follow_up_decision=turn.decision,
            focus_point=turn.focus_point,
            respondent_member_id=participant.member_id,
        )


def _extract_last_user_text(chat_ctx: llm_types.ChatContext) -> str:
    """ChatContext 에서 가장 최근 user 메시지의 텍스트를 반환."""
    for item in reversed(chat_ctx.items):
        if getattr(item, "role", None) == "user":
            return item.text_content or ""
    return ""


from livekit.agents import WorkerOptions

def _create_turn_handling_options() -> TurnHandlingOptions:
    base = {"endpointing": {"min_delay": 3600.0, "max_delay": 3600.0}}
    for key in ("allow_interruptions", "allow_barge_in", "barge_in", "interruptible"):
        candidate = dict(base)
        candidate[key] = False
        try:
            return TurnHandlingOptions(**candidate)
        except TypeError:
            pass
    return TurnHandlingOptions(**base)

# ─────────────────────────────────────────────────────────
# Worker 정의
# ─────────────────────────────────────────────────────────

server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    """워커 프로세스 시작 시 한 번만 로드되는 무거운 리소스."""
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


async def entrypoint(ctx: JobContext) -> None:
    """Room 이 배정될 때마다 호출되는 진입점."""
    metadata = _load_metadata(ctx)
    session_id = metadata["sessionId"]
    mode = metadata.get("mode", "SOLO").upper()
    job_role = metadata.get("jobRole", "BACKEND")
    resume_text = metadata.get("resumeText", "")
    cover_letter_text = metadata.get("coverLetterText", "")
    participants = metadata.get("participants", [])

    ctx.log_context_fields = {
        "room": ctx.room.name,
        "session_id": session_id,
    }
    logger.info(
        "[entrypoint] room=%s session=%s mode=%s job_role=%s resume_len=%d cover_len=%d participants=%d",
        ctx.room.name,
        session_id,
        mode,
        job_role,
        len(resume_text),
        len(cover_letter_text),
        len(participants) if isinstance(participants, list) else 0,
    )

    llm_service = create_llm_service()

    session = AgentSession(
        stt=inference.STT("deepgram/nova-3", language="ko"),
        tts=inference.TTS(
            "elevenlabs/eleven_flash_v2_5",
            voice=os.getenv("TTS_VOICE", "Xb7hH8MSUJpSbSDYk0k2"),  # Alice (polite female)
            language="ko",
        ),
        vad=ctx.proc.userdata["vad"],
        # 자동 턴 종료 비활성화.
        # 면접은 사용자가 생각하느라 침묵하는 경우가 잦아 VAD/턴감지 기반 자동
        # 종료가 오히려 방해된다. 턴 전환은 프론트 버튼 또는 1분30초 타이머 같은
        # 외부 트리거로만 수행한다.
        # STT 자체는 계속 돌아가므로 사용자 발화는 실시간으로 수집된다.
        turn_handling=_create_turn_handling_options(),
    )

    if mode == "GROUP":
        if not isinstance(participants, list) or not participants:
            logger.error("GROUP metadata participants 가 비어 있어 SOLO fallback 사용")
            agent = InterviewerAgent(
                session_id=session_id,
                job_role=job_role,
                resume_text=resume_text,
                cover_letter_text=cover_letter_text,
                llm_service=llm_service,
            )
        else:
            agent = GroupInterviewerAgent(
                session_id=session_id,
                job_role=job_role,
                participants=participants,
                fallback_resume_text=resume_text,
                cover_letter_text=cover_letter_text,
                llm_service=llm_service,
            )
    else:
        agent = InterviewerAgent(
            session_id=session_id,
            job_role=job_role,
            resume_text=resume_text,
            cover_letter_text=cover_letter_text,
            llm_service=llm_service,
        )

    # 사용자 참가 대기 (§9.3: Frontend가 Room 접속 전에 발화하면 첫 질문을 놓침)
    await ctx.wait_for_participant()

    await session.start(
        agent=agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(),
        room_output_options=RoomOutputOptions(),
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="interviewer-agent",
        )
    )
