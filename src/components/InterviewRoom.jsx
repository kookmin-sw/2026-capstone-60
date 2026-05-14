import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import useCountdown from "../hooks/useCountdown";
import useNextQuestionGuard from "../hooks/useNextQuestionGuard";
import { nextQuestion } from "../api/interviewApi";

const WARNING_THRESHOLD = 10;
const AGENT_TIMEOUT_MS = 60000; // 60초 (TTS 초기화 시간 고려)
const NEXT_COOLDOWN_MS = 2000;
const EXPIRES_AT_FALLBACK_THRESHOLD_MS = 5000;

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

  // 절대 시각(ms) 기반 타이머 deadline.
  // - interviewExpiresAt: 면접 시작 시점에 한 번 고정.
  // - answerExpiresAt: 매 턴마다 갱신 (첫 턴 시작 / /next 응답 / Agent QUESTION 수신).
  //   Mock 모드는 컴포넌트 마운트 즉시 첫 질문이 표시되므로 초기값을 바로 설정한다.
  //   실제 모드는 Agent 의 QUESTION DataMessage 수신 시 설정된다.
  const [interviewExpiresAt] = useState(() => Date.now() + totalDurationSeconds * 1000);
  const [answerExpiresAt, setAnswerExpiresAt] = useState(
    () => session.livekit?.isMock ? Date.now() + answerTimeLimitSeconds * 1000 : null
  );

  // 동기 가드 (in-flight + cooldown).
  const nextGuard = useNextQuestionGuard({ cooldownMs: NEXT_COOLDOWN_MS });
  // 턴 SSOT 검증을 위해 ref 도 유지 (closure 안에서 최신 값 즉시 참조).
  const turnRef = useRef(1);

  const updateTurn = useCallback((next) => {
    turnRef.current = next;
    setTurn(next);
  }, []);

  // 답변 타이머 만료 시 자동으로 /next 호출.
  // in-flight 차단은 nextGuard.tryAcquire 가 담당하므로 여기서는 ending 만 검사.
  const handleAnswerTimerExpire = useCallback(async () => {
    if (ending) return;
    addLog("SYSTEM", `Q${turnRef.current} 답변 시간이 종료되었습니다. 다음 질문을 요청합니다.`);
    await requestNextQuestion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ending]);

  const interviewTimer = useCountdown({
    expiresAt: interviewExpiresAt,
    isActive: isConnected && !ending && !waitingForAgent,
    onFinish: useCallback(() => onSessionEnd("TIME_OVER"), [onSessionEnd]),
  });

  const answerTimer = useCountdown({
    expiresAt: answerExpiresAt,
    isActive:
      isConnected && !ending && !waitingForAgent && currentQuestion !== "" && answerExpiresAt != null,
    onFinish: handleAnswerTimerExpire,
  });

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
  // 턴 SSOT: /next 응답으로 setTurn 한 직후 Agent QUESTION 의 turnNumber 와 일치해야 한다.
  // 불일치 시 경고를 남기고 Agent 값으로 정렬 (Agent 가 실제 질문 텍스트의 출처이므로).
  const handleDataReceived = useCallback((payload) => {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload));
      if (msg.type === "QUESTION") {
        const { turnNumber, text } = msg.payload;
        if (typeof turnNumber === "number" && turnNumber !== turnRef.current) {
          console.warn(
            `[InterviewRoom] 턴 번호 불일치: client=${turnRef.current}, agent=${turnNumber}. ` +
            `Agent 값으로 정렬합니다.`
          );
          addLog(
            "WARN",
            `턴 번호 불일치 감지 (서버=${turnRef.current}, 면접관=${turnNumber}). 면접관 값으로 갱신합니다.`
          );
          updateTurn(turnNumber);
        }
        setCurrentQuestion(text);
        setWaitingForAgent(false);
        setWarningVisible(false);
        // 첫 턴 또는 /next 응답에 expiresAt 이 없었던 경우를 대비해 풀 시간으로 deadline 설정.
        // /next 응답에 정상 expiresAt 이 있었다면 이 시점에는 이미 그 값이 적용된 상태.
        setAnswerExpiresAt(Date.now() + answerTimeLimitSeconds * 1000);
        addLog("QUESTION", `Q${turnNumber}. ${text}`);
      }
    } catch (e) {
      // 파싱 실패 시 무시
    }
  }, [answerTimeLimitSeconds, updateTurn]);

  // LiveKit Room 연결
  useEffect(() => {
    if (session.livekit?.isMock) {
      setIsConnected(true);
      setWaitingForAgent(false);
      setCurrentQuestion("최근 프로젝트에서 가장 어려웠던 기술 의사결정 사례를 설명해주세요.");
      // answerExpiresAt 은 useState 초기값에서 이미 설정됨.
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

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === "audio") {
        track.detach().forEach((el) => el.remove());
      }
    });

    room.on(RoomEvent.DataReceived, handleDataReceived);

    room.on(RoomEvent.ParticipantConnected, () => {
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
    if (inFlightRef.current) return;
    const now = Date.now();
    if (now - lastNextAtRef.current < NEXT_COOLDOWN_MS) return;
    inFlightRef.current = true;
    lastNextAtRef.current = now;
    setNextLoading(true);

    try {
      const response = await nextQuestion(session.sessionId, turnRef.current);
      const data = response?.data ?? response ?? {};

      // 턴 번호 즉시 동기화 (실제/Mock 공통).
      if (typeof data.turnNumber === "number") {
        updateTurn(data.turnNumber);
      }
      if (session.livekit?.isMock) {
        setCurrentQuestion(`Mock 질문 ${data.turnNumber}: 다음 질문입니다.`);
      }

      // 답변 deadline 설정. 비정상 expiresAt(<=5초) 은 풀 시간으로 폴백 + 사용자 노출 경고.
      let nextDeadline = Date.now() + answerTimeLimitSeconds * 1000;
      if (data.expiresAt) {
        const parsed = new Date(data.expiresAt).getTime();
        const ms = parsed - Date.now();
        if (ms > EXPIRES_AT_FALLBACK_THRESHOLD_MS) {
          nextDeadline = parsed;
        } else {
          console.warn(
            `[InterviewRoom] 비정상 expiresAt 수신 (남은 ms=${ms}). ` +
            `답변 시간을 ${answerTimeLimitSeconds}초로 폴백합니다.`
          );
          addLog(
            "WARN",
            `서버 타이머가 비정상입니다. 답변 시간을 ${answerTimeLimitSeconds}초로 재설정했습니다.`
          );
        }
      }
      setAnswerExpiresAt(nextDeadline);
      setWarningVisible(false);

      addLog("SYSTEM", `다음 질문을 요청했습니다. (턴 ${data.turnNumber})`);
    } catch (err) {
      addLog("SYSTEM", `다음 질문 요청 실패: ${err.message}`);
      // 실패 시 풀 시간으로 폴백 (secondsLeft=0 잔류로 인한 재발화 방지).
      setAnswerExpiresAt(Date.now() + answerTimeLimitSeconds * 1000);
    } finally {
      setNextLoading(false);
      nextGuard.release();
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
          <div className={`timer-box ${answerExpiresAt != null && answerTimer.secondsLeft <= 15 ? "danger" : ""}`}>
            <span>답변 남은 시간 ({Math.floor(answerTimeLimitSeconds / 60)}:{String(answerTimeLimitSeconds % 60).padStart(2, "0")})</span>
            <strong>{answerExpiresAt == null ? "대기 중" : answerTimer.formatted}</strong>
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
