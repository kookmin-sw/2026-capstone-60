"""
세션 저장소 모듈.
session_id 기준으로 대화 기록과 면접 상태를 메모리에 관리한다.
"""

from dataclasses import dataclass, field


@dataclass
class ConversationTurn:
    """대화 한 턴 (질문 + 답변)."""
    question: str
    answer: str = ""
    is_follow_up: bool = False
    intent: str = ""  # 출제 의도


@dataclass
class InterviewSession:
    """면접 세션 상태."""
    session_id: str
    job_role: str
    resume_text: str
    system_prompt: str
    question_number: int = 1
    follow_up_count: int = 0
    history: list[ConversationTurn] = field(default_factory=list)
    is_finished: bool = False

    def add_question(self, question: str, is_follow_up: bool = False, intent: str = ""):
        """새 질문을 기록한다."""
        self.history.append(ConversationTurn(
            question=question,
            is_follow_up=is_follow_up,
            intent=intent,
        ))

    def add_answer(self, answer: str):
        """마지막 질문에 대한 답변을 기록한다."""
        if self.history:
            self.history[-1].answer = answer

    def get_messages(self) -> list[dict]:
        """Bedrock converse API에 넘길 메시지 리스트를 생성한다."""
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

    def get_conversation_text(self) -> str:
        """리포트 생성용 대화 기록 텍스트를 반환한다."""
        lines = []
        for i, turn in enumerate(self.history, 1):
            lines.append(f"[질문 {i}] {turn.question}")
            if turn.intent:
                lines.append(f"[출제 의도] {turn.intent}")
            if turn.answer:
                lines.append(f"[답변 {i}] {turn.answer}")
            lines.append("")
        return "\n".join(lines)


# 메모리 기반 세션 저장소
_sessions: dict[str, InterviewSession] = {}


def create_session(
    session_id: str,
    job_role: str,
    resume_text: str,
    system_prompt: str,
) -> InterviewSession:
    """새 세션을 생성하고 저장한다."""
    session = InterviewSession(
        session_id=session_id,
        job_role=job_role,
        resume_text=resume_text,
        system_prompt=system_prompt,
    )
    _sessions[session_id] = session
    return session


def get_session(session_id: str) -> InterviewSession | None:
    """세션을 조회한다."""
    return _sessions.get(session_id)
