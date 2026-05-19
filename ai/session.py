"""
면접 세션 상태.

rag/fastapi_server/session_store.py 의 단순화 버전.
Agent 프로세스 하나 = 면접 세션 하나이므로 전역 dict 저장소가 필요 없다.
InterviewerAgent 가 InterviewSession 인스턴스 하나를 직접 보유한다.
"""

import random
from dataclasses import dataclass, field


@dataclass
class ConversationTurn:
    """대화 한 턴 (질문 + 답변)."""
    question: str
    turn_number: int = 0
    answer: str = ""
    is_follow_up: bool = False
    parent_turn_number: int = 0
    question_types: str = ""
    answer_summary: list[str] = field(default_factory=list)
    decision: str = ""
    focus_point: str = ""


@dataclass
class InterviewSession:
    """면접 세션 상태."""
    session_id: str
    job_role: str
    resume_text: str
    system_prompt: str
    cover_letter_text: str = ""
    history: list[ConversationTurn] = field(default_factory=list)
    current_answer_buffer: str = ""

    def add_question(
        self,
        question: str,
        is_follow_up: bool = False,
        question_types: str = "",
        turn_number: int = 0,
        parent_turn_number: int = 0,
    ) -> None:
        """새 질문을 기록한다."""
        self.history.append(ConversationTurn(
            question=question,
            turn_number=turn_number,
            is_follow_up=is_follow_up,
            parent_turn_number=parent_turn_number,
            question_types=question_types,
        ))

    def add_answer(self, answer: str) -> None:
        """마지막 질문에 대한 답변을 기록한다."""
        if self.history:
            self.history[-1].answer = answer

    def set_last_turn_analysis(
        self,
        answer_summary: list[str],
        decision: str,
        focus_point: str,
    ) -> None:
        """마지막 턴의 요약/판단 결과를 기록한다."""
        if self.history:
            self.history[-1].answer_summary = answer_summary
            self.history[-1].decision = decision
            self.history[-1].focus_point = focus_point

    def append_to_buffer(self, text: str) -> None:
        """STT 확정 텍스트를 답변 버퍼에 누적한다."""
        if text:
            if self.current_answer_buffer:
                self.current_answer_buffer += " " + text
            else:
                self.current_answer_buffer = text

    def flush_buffer(self) -> str:
        """버퍼 내용을 반환하고 초기화한다. add_answer 호출은 caller 책임."""
        answer = self.current_answer_buffer
        self.current_answer_buffer = ""
        return answer

    def get_bedrock_messages(self) -> list[dict]:
        """Bedrock Converse API 에 넘길 messages 리스트."""
        messages = []
        for turn in self.history:
            messages.append({
                "role": "assistant",
                "content": [{"text": turn.question}],
            })
            if turn.answer:
                messages.append({
                    "role": "user",
                    "content": [{"text": turn.answer}],
                })
        return messages

    def get_asked_topics(self) -> str:
        """새 주제 질문 생성 시 '이미 다룬 내용' 주입용 텍스트."""
        if not self.history:
            return "(아직 질문한 내용 없음)"
        return "\n".join(
            f"- 질문: {turn.question} (유형: {turn.question_types})"
            for turn in self.history
        )


@dataclass
class ParticipantInterviewSession:
    """그룹 면접 참가자별 상태."""
    member_id: int
    identity: str
    name: str
    interview: InterviewSession


@dataclass
class GroupInterviewSession:
    """그룹 면접 세션 상태."""
    session_id: str
    job_role: str
    participants: list[ParticipantInterviewSession]
    round_number: int = 0
    round_order: list[int] = field(default_factory=list)
    round_position: int = 0
    current_turn_number: int = 1
    last_processed_next_turn_number: int = 0
    follow_up_active: bool = False

    def current_participant(self) -> ParticipantInterviewSession:
        if not self.round_order:
            self.start_new_round()
        return self.participants[self.round_order[self.round_position]]

    def start_new_round(self) -> None:
        self.round_number += 1
        self.round_order = list(range(len(self.participants)))
        random.shuffle(self.round_order)
        self.round_position = 0

    def advance_speaker(self) -> ParticipantInterviewSession:
        if not self.round_order:
            self.start_new_round()
            return self.current_participant()

        self.round_position += 1
        if self.round_position >= len(self.round_order):
            self.start_new_round()
        return self.current_participant()
