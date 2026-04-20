import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import useCountdown from "../hooks/useCountdown";

const ANSWER_TIME_LIMIT = 90;
const WARNING_THRESHOLD = 10;
const QUESTION_BANK = [
  "최근 프로젝트에서 가장 어려웠던 기술 의사결정 사례를 설명해주세요.",
  "왜 해당 구조를 선택했는지, 대안과의 트레이드오프를 함께 말해주세요.",
  "장애가 발생했던 경험이 있다면 원인 분석과 재발 방지 방안을 설명해주세요.",
  "성능 최적화를 위해 직접 측정했던 지표와 개선 결과를 설명해주세요.",
];

export default function InterviewRoom({
  session,
  onSessionEnd,
  ending,
}) {
  const roomRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [turnExpired, setTurnExpired] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [turn, setTurn] = useState(1);
  const [logs, setLogs] = useState([]);

  const interviewTimer = useCountdown(
    session.durationMinutes * 60,
    Boolean(session) && !ending,
    useCallback(() => {
      onSessionEnd("TIME_OVER");
    }, [onSessionEnd])
  );

  const answerTimer = useCountdown(
    ANSWER_TIME_LIMIT,
    Boolean(session) && !ending,
    useCallback(() => {
      setTurnExpired(true);
      setLogs((prev) => [
        {
          id: `${Date.now()}-timeout`,
          type: "SYSTEM",
          text: `Q${turn} 답변 시간이 종료되어 다음 질문 준비 상태로 전환됐습니다.`,
        },
        ...prev,
      ]);
    }, [turn])
  );

  const canAskNextQuestion = interviewTimer.secondsLeft > ANSWER_TIME_LIMIT;
  const currentQuestion = useMemo(
    () => QUESTION_BANK[(turn - 1) % QUESTION_BANK.length],
    [turn]
  );

  useEffect(() => {
    if (answerTimer.secondsLeft === WARNING_THRESHOLD) {
      setWarningVisible(true);
      setLogs((prev) => [
        {
          id: `${Date.now()}-warning`,
          type: "ALERT",
          text: "10초 후 답변이 종료됩니다.",
        },
        ...prev,
      ]);
    }
    if (answerTimer.secondsLeft > WARNING_THRESHOLD) {
      setWarningVisible(false);
    }
  }, [answerTimer.secondsLeft]);

  useEffect(() => {
    if (turnExpired && !canAskNextQuestion) {
      onSessionEnd("TIME_OVER");
    }
  }, [turnExpired, canAskNextQuestion, onSessionEnd]);

  useEffect(() => {
    if (session.livekit?.isMock) {
      setIsConnected(true);
      return undefined;
    }

    const room = new Room();
    roomRef.current = room;

    async function connectRoom() {
      try {
        await room.connect(session.livekit.url, session.livekit.accessToken);
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsConnected(true);
      } catch (error) {
        setConnectionError(error.message || "LiveKit 연결에 실패했습니다.");
      }
    }

    room.on(RoomEvent.Disconnected, () => {
      setIsConnected(false);
    });

    connectRoom();

    return () => {
      room.disconnect();
    };
  }, [session.livekit.accessToken, session.livekit.url]);

  const toggleMic = async () => {
    if (session.livekit?.isMock) {
      setIsMicOn((prev) => !prev);
      return;
    }
    if (!roomRef.current) return;
    const next = !isMicOn;
    await roomRef.current.localParticipant.setMicrophoneEnabled(next);
    setIsMicOn(next);
  };

  const nextAnswerTurn = () => {
    if (!canAskNextQuestion) return;
    setTurnExpired(false);
    setWarningVisible(false);
    setTurn((prev) => prev + 1);
    setLogs((prev) => [
      {
        id: `${Date.now()}-next`,
        type: "QUESTION",
        text: `다음 질문으로 이동했습니다. (Q${turn + 1})`,
      },
      ...prev,
    ]);
    answerTimer.reset(ANSWER_TIME_LIMIT);
  };

  const endInterview = async () => {
    await onSessionEnd("USER_STOP");
  };

  return (
    <div className="layout-two-col">
      <section className="card room-card">
        <div className="header-row">
          <div>
            <p className="eyebrow">Session</p>
            <h2>면접 진행 중</h2>
          </div>
          <span className={`chip ${isConnected ? "success" : "warn"}`}>
            {isConnected ? "LiveKit 연결됨" : "연결 확인 중"}
          </span>
        </div>

        <div className="room-meta">
          <p>
            <strong>Session ID</strong> {session.sessionId}
          </p>
          <p>
            <strong>Room</strong> {session.livekit.roomName}
          </p>
        </div>

        <div className="timer-grid">
          <div className="timer-box">
            <span>전체 남은 시간</span>
            <strong>{interviewTimer.formatted}</strong>
          </div>
          <div className={`timer-box ${answerTimer.secondsLeft <= 15 ? "danger" : ""}`}>
            <span>답변 남은 시간 (1:30)</span>
            <strong>{answerTimer.formatted}</strong>
          </div>
        </div>

        <div className="question-box">
          <p className="eyebrow">Current Question</p>
          <h3>Q{turn}. {currentQuestion}</h3>
          <p className="subtext compact">
            답변이 충분하면 일반 질문, 부족하면 꼬리 질문으로 이어질 수 있습니다.
          </p>
        </div>

        {warningVisible && (
          <div className="notice warn">
            10초 후 답변이 종료됩니다. 핵심 결론을 먼저 말해주세요.
          </div>
        )}

        {turnExpired && (
          <div className="notice">
            90초가 지났습니다. {canAskNextQuestion ? "다음 질문으로 넘어가세요." : "남은 전체 시간이 짧아 다음 질문은 생성되지 않고 면접이 종료됩니다."}
          </div>
        )}

        {connectionError && <div className="error">{connectionError}</div>}

        <div className="action-row">
          <button className="ghost-btn" type="button" onClick={toggleMic}>
            {isMicOn ? "마이크 끄기" : "마이크 켜기"}
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={nextAnswerTurn}
            disabled={!canAskNextQuestion}
          >
            다음 질문 시작 (타이머 리셋)
          </button>
          <button className="danger-btn" type="button" onClick={endInterview} disabled={ending}>
            {ending ? "종료 처리 중..." : "면접 종료"}
          </button>
        </div>
      </section>

      <aside className="card side-card">
        <h3>진행 상태</h3>
        <ul className="status-list">
          <li>현재 턴: {turn}번</li>
          <li>답변 제한: 1분 30초</li>
          <li>10초 전 종료 알림 활성화</li>
          <li>세션 종료 후 자동 평가 진행</li>
        </ul>
        <div className="event-log">
          <strong>실시간 로그</strong>
          {logs.length === 0 && <p className="subtext compact">아직 이벤트가 없습니다.</p>}
          {logs.slice(0, 4).map((log) => (
            <p key={log.id}>
              [{log.type}] {log.text}
            </p>
          ))}
        </div>
      </aside>
    </div>
  );
}
