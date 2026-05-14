import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import useCountdown from "../hooks/useCountdown";
import { nextQuestion } from "../api/interviewApi";

const WARNING_THRESHOLD = 10;
const AGENT_TIMEOUT_MS = 60000; // 60초 (TTS 초기화 시간 고려)

export default function InterviewRoom({
  session,
  onSessionEnd,
  ending,
}) {
  const roomRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [connectionError, setConnectionError] = useState("");
  const [warningVisible, setWarningVisible] = useState(false);
  const [turn, setTurn] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [waitingForAgent, setWaitingForAgent] = useState(true);
  const [agentTimedOut, setAgentTimedOut] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const answerTimeLimitSeconds = session.answerTimeLimitSeconds || 90;
  const totalDurationSeconds = session.totalDurationSeconds || session.durationMinutes * 60;

  // 동기 in-flight 가드.
  // React state(nextLoading)는 비동기 setState라 같은 렌더 프레임 내 두 번째
  // 호출이 false로 캡처된 채 통과할 수 있다. ref는 동기적으로 즉시 반영된다.
  const inFlightRef = useRef(false);

  // 답변 타이머 만료 시 자동으로 /next 호출.
  // nextLoading(state) 대신 inFlightRef(ref)로 검사해 동기 차단.
  const handleAnswerTimerExpire = useCallback(async () => {
    if (ending || inFlightRef.current) return;
    addLog("SYSTEM", `Q${turn} 답변 시간이 종료되었습니다. 다음 질문을 요청합니다.`);
    await requestNextQuestion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, ending]);

  const interviewTimer = useCountdown(
    totalDurationSeconds,
    isConnected && !ending && !waitingForAgent,
    useCallback(() => {
      onSessionEnd("TIME_OVER");
    }, [onSessionEnd])
  );

  const answerTimer = useCountdown(
    answerTimeLimitSeconds,
    isConnected && !ending && !waitingForAgent && currentQuestion !== "",
    handleAnswerTimerExpire
  );

  const canAskNextQuestion = interviewTimer.secondsLeft > answerTimeLimitSeconds;

  // 10초 전 경고
  useEffect(() => {
    if (answerTimer.secondsLeft === WARNING_THRESHOLD && answerTimer.secondsLeft > 0) {
      setWarningVisible(true);
      addLog("ALERT", "10초 후 답변이 종료됩니다.");
    }
    if (answerTimer.secondsLeft > WARNING_THRESHOLD) {
      setWarningVisible(false);
    }
  }, [answerTimer.secondsLeft]);

  // Agent QUESTION 메시지 수신 핸들러
  const handleDataReceived = useCallback((payload, participant, kind, topic) => {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload));
      if (msg.type === "QUESTION") {
        const { turnNumber, text } = msg.payload;
        setTurn(turnNumber);
        setCurrentQuestion(text);
        setWaitingForAgent(false);
        setWarningVisible(false);
        answerTimer.reset(answerTimeLimitSeconds);
        addLog("QUESTION", `Q${turnNumber}. ${text}`);
      }
    } catch (e) {
      // 파싱 실패 시 무시
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answerTimeLimitSeconds]);

  // LiveKit Room 연결
  useEffect(() => {
    if (session.livekit?.isMock) {
      setIsConnected(true);
      setWaitingForAgent(false);
      setCurrentQuestion("최근 프로젝트에서 가장 어려웠던 기술 의사결정 사례를 설명해주세요.");
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

    room.on(RoomEvent.Disconnected, () => setIsConnected(false));

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === "audio") {
        const audioEl = track.attach();
        audioEl.id = `audio-${participant.identity}`;
        document.body.appendChild(audioEl);
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (track.kind === "audio") {
        track.detach().forEach((el) => el.remove());
      }
    });

    room.on(RoomEvent.DataReceived, handleDataReceived);

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      setWaitingForAgent(false);
      addLog("SYSTEM", "AI 면접관이 접속했습니다. 첫 질문을 준비 중입니다.");
    });

    const checkExistingParticipants = () => {
      if (room.remoteParticipants.size > 0) {
        setWaitingForAgent(false);
        addLog("SYSTEM", "AI 면접관이 이미 접속해 있습니다.");
      }
    };

    connectRoom().then(checkExistingParticipants);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.remoteParticipants.forEach((p) => {
        p.audioTrackPublications.forEach((pub) => {
          if (pub.track) pub.track.detach().forEach((el) => el.remove());
        });
      });
      room.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.livekit.accessToken, session.livekit.url]);

  // Agent 접속 타임아웃
  useEffect(() => {
    if (!isConnected || !waitingForAgent || session.livekit?.isMock) return undefined;

    const timeout = setTimeout(() => {
      if (waitingForAgent) {
        setAgentTimedOut(true);
        setConnectionError("AI 면접관이 응답하지 않습니다. 잠시 후 다시 시도해주세요.");
        addLog("SYSTEM", "Agent 접속 타임아웃 — 면접을 시작할 수 없습니다.");
      }
    }, AGENT_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [isConnected, waitingForAgent, session.livekit?.isMock]);

  // "다음 질문" 버튼 → POST /next
  const requestNextQuestion = async () => {
    if (!canAskNextQuestion || ending) return;
    if (inFlightRef.current) return;   // 동기 중복 차단
    inFlightRef.current = true;
    setNextLoading(true);

    try {
      const response = await nextQuestion(session.sessionId, turn);
      // /next 응답 turnNumber 즉시 동기화 (실제 모드 / Mock 모드 공통).
      // 이전에는 Mock 모드에서만 setTurn을 호출했다. 실제 모드에서는 Agent의
      // QUESTION DataMessage를 기다렸기 때문에 그 사이 /next가 한 번 더 나가면
      // 이전 turn 값이 currentTurnNumber로 들어가 백엔드 warn 로그가 찍혔다.
      // 응답값으로 즉시 갱신해 다음 /next 호출의 currentTurnNumber를 정확히 맞춘다.
      // (실제 모드에서 질문 텍스트는 여전히 Agent의 QUESTION DataMessage로 수신)
      const data = response?.data ?? response ?? {};
      if (typeof data.turnNumber === "number") {
        setTurn(data.turnNumber);
      }
      if (session.livekit?.isMock) {
        setCurrentQuestion(`Mock 질문 ${data.turnNumber}: 다음 질문입니다.`);
      }

      // expiresAt 안전 처리: Math.max(1, ...) 하한 클램프 제거.
      // 클램프가 비정상 expiresAt(과거/누락)을 1초로 만들어 1초 루프를 유발했다.
      // 5초 이하면 비정상으로 판단해 풀 시간으로 폴백하고 로그에 경고를 남긴다.
      let remaining = answerTimeLimitSeconds;
      if (data.expiresAt) {
        const ms = new Date(data.expiresAt).getTime() - Date.now();
        if (ms > 5000) {
          remaining = Math.round(ms / 1000);
        } else {
          console.warn(
            `[InterviewRoom] 비정상 expiresAt 수신 (남은 ms=${ms}). ` +
            `답변 시간을 ${answerTimeLimitSeconds}초로 폴백합니다.`
          );
          addLog("WARN", `서버 타이머가 비정상입니다. 답변 시간을 ${answerTimeLimitSeconds}초로 재설정했습니다.`);
        }
      }
      answerTimer.reset(remaining);

      setWarningVisible(false);

      addLog("SYSTEM", `다음 질문을 요청했습니다. (턴 ${data.turnNumber})`);
    } catch (err) {
      addLog("SYSTEM", `다음 질문 요청 실패: ${err.message}`);
      // 실패 시에도 타이머를 풀 시간으로 리셋해 secondsLeft=0 잔류 방지
      answerTimer.reset(answerTimeLimitSeconds);
    } finally {
      setNextLoading(false);
      inFlightRef.current = false;
    }
  };

  // 전체 타이머 만료 시 남은 답변 시간이 부족하면 종료
  useEffect(() => {
    if (!canAskNextQuestion && answerTimer.secondsLeft === 0 && !ending) {
      onSessionEnd("TIME_OVER");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAskNextQuestion, answerTimer.secondsLeft, ending]);

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

  const endInterview = async () => {
    await onSessionEnd("USER_STOP");
  };

  function addLog(type, text) {
    setLogs((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, text },
      ...prev,
    ]);
  }

  if (waitingForAgent && !session.livekit?.isMock) {
    return (
      <section className="card">
        <div className="header-row">
          <div>
            <p className="eyebrow">Session</p>
            <h2>AI 면접관 대기 중</h2>
          </div>
          <span className={`chip ${isConnected ? "success" : "warn"}`}>
            {isConnected ? "LiveKit 연결됨" : "연결 확인 중"}
          </span>
        </div>

        {agentTimedOut ? (
          <div className="error">
            {connectionError}
            <br />
            <button className="ghost-btn" type="button" onClick={() => window.location.reload()}>
              새로고침
            </button>
          </div>
        ) : (
          <div className="spinner-wrap">
            <div className="spinner" />
            <span>AI 면접관이 접속할 때까지 기다리고 있습니다...</span>
          </div>
        )}

        <div className="room-meta">
          <p><strong>Session ID</strong> {session.sessionId}</p>
          <p><strong>Room</strong> {session.livekit.roomName}</p>
        </div>
      </section>
    );
  }

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
          <p><strong>Session ID</strong> {session.sessionId}</p>
          <p><strong>Room</strong> {session.livekit.roomName}</p>
        </div>

        <div className="timer-grid">
          <div className="timer-box">
            <span>전체 남은 시간</span>
            <strong>{interviewTimer.formatted}</strong>
          </div>
          <div className={`timer-box ${answerTimer.secondsLeft <= 15 ? "danger" : ""}`}>
            <span>답변 남은 시간 ({Math.floor(answerTimeLimitSeconds / 60)}:{String(answerTimeLimitSeconds % 60).padStart(2, "0")})</span>
            <strong>{answerTimer.formatted}</strong>
          </div>
        </div>

        <div className="question-box">
          <p className="eyebrow">Current Question</p>
          {currentQuestion ? (
            <h3>Q{turn}. {currentQuestion}</h3>
          ) : (
            <h3 className="subtext">질문을 기다리는 중...</h3>
          )}
          <p className="subtext compact">
            답변이 충분하면 일반 질문, 부족하면 꼬리 질문으로 이어질 수 있습니다.
          </p>
        </div>

        {warningVisible && (
          <div className="notice warn">
            10초 후 답변이 종료됩니다. 핵심 결론을 먼저 말해주세요.
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
            onClick={requestNextQuestion}
            disabled={!canAskNextQuestion || nextLoading || ending}
          >
            {nextLoading ? "요청 중..." : "다음 질문"}
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
          <li>답변 제한: {Math.floor(answerTimeLimitSeconds / 60)}분 {answerTimeLimitSeconds % 60}초</li>
          <li>10초 전 종료 알림 활성화</li>
          <li>세션 종료 후 자동 평가 진행</li>
        </ul>
        <div className="event-log">
          <strong>실시간 로그</strong>
          {logs.length === 0 && <p className="subtext compact">아직 이벤트가 없습니다.</p>}
          {logs.slice(0, 6).map((log) => (
            <p key={log.id}>
              [{log.type}] {log.text}
            </p>
          ))}
        </div>
      </aside>
    </div>
  );
}
