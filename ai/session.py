"""
면접 세션 상태.

rag/fastapi_server/session_store.py 의 단순화 버전.
Agent 프로세스 하나 = 면접 세션 하나이므로 전역 dict 저장소가 필요 없다.
InterviewerAgent 가 InterviewSession 인스턴스 하나를 직접 보유한다.
"""

from dataclasses import dataclass, field


@dataclass
class ConversationTurn:
    """대화 한 턴 (질문 + 답변)."""
    question: str
    answer: str = ""
    is_follow_up: bool = False
    intent: str = ""


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

    def add_question(self, question: str, is_follow_up: bool = False, intent: str = "") -> None:
        """새 질문을 기록한다."""
        self.history.append(ConversationTurn(
            question=question,
            is_follow_up=is_follow_up,
            intent=intent,
        ))

    def add_answer(self, answer: str) -> None:
        """마지막 질문에 대한 답변을 기록한다."""
        if self.history:
            self.history[-1].answer = answer

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
            f"- 질문: {turn.question} (의도: {turn.intent})"
            for turn in self.history
        )
