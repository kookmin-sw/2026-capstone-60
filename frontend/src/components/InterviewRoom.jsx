/**
 * InterviewRoom — 면접룸 컨테이너 (비즈니스 로직 전담)
 *
 * - LiveKit Room 연결
 * - 절대 시각 기반 답변/전체 타이머
 * - /next 요청 가드 (in-flight + cooldown)
 * - 턴 SSOT 검증 (서버 응답 vs Agent QUESTION)
 * - 진행 로그 관리
 *
 * 시각은 InterviewRoomView 가 전담. 본 컴포넌트는 props 만 주입한다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import useCountdown from "../hooks/useCountdown";
import useNextQuestionGuard from "../hooks/useNextQuestionGuard";
import { getInterviewResult, nextQuestion } from "../api/interviewApi";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import InterviewRoomView from "./InterviewRoomView";

const WARNING_THRESHOLD = 10;
const AGENT_TIMEOUT_MS = 60000;
const NEXT_COOLDOWN_MS = 2000;
const EXPIRES_AT_FALLBACK_THRESHOLD_MS = 5000;

// 화면에 표시하지 않는 로그 타입 (시스템 메시지 등)
const HIDDEN_LOG_TYPES = new Set(["SYSTEM"]);

export default function InterviewRoom({
  session,
  onSessionEnd,
  onSessionLeave,
  onGuestFeedbackReady,
  ending,
}) {
  const roomRef = useRef(null);
  const myIdentityRef = useRef("");
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [localIdentity, setLocalIdentity] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [warningVisible, setWarningVisible] = useState(false);
  const [turn, setTurn] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [waitingForAgent, setWaitingForAgent] = useState(true);
  const [agentTimedOut, setAgentTimedOut] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  // 단순 휴리스틱: 면접관 발화 직후 잠시 "ai", 그 외엔 "user"
  const [currentTurnRole, setCurrentTurnRole] = useState("waiting");
  const [targetIdentity, setTargetIdentity] = useState(null);

  const isGroup = session.mode === "GROUP";
  const myIdentity = session.myIdentity || localIdentity;
  myIdentityRef.current = myIdentity || "";
  const isMyActiveTurn = !isGroup || !targetIdentity || targetIdentity === myIdentity;

  const answerTimeLimitSeconds = session.answerTimeLimitSeconds || 90;
  const totalDurationSeconds = session.totalDurationSeconds || session.durationMinutes * 60;

  const [interviewExpiresAt] = useState(() => Date.now() + totalDurationSeconds * 1000);
  const [answerExpiresAt, setAnswerExpiresAt] = useState(
    () => session.livekit?.isMock ? Date.now() + answerTimeLimitSeconds * 1000 : null
  );

  const nextGuard = useNextQuestionGuard({ cooldownMs: NEXT_COOLDOWN_MS });
  const turnRef = useRef(1);

  const updateTurn = useCallback((next) => {
    turnRef.current = next;
    setTurn(next);
  }, []);

  const setLocalMicPublish = useCallback(async (enabled) => {
    const room = roomRef.current;
    if (!room || session.livekit?.isMock) {
      setIsMicOn(enabled);
      return;
    }

    try {
      await room.localParticipant.setMicrophoneEnabled(enabled);
      setIsMicOn(enabled);
    } catch (error) {
      console.warn("[InterviewRoom] microphone publish update failed", error);
      addLog("WARN", "마이크 상태 변경에 실패했습니다. 브라우저 권한 또는 장치 상태를 확인해주세요.");
    }
  }, [session.livekit?.isMock]);

  const syncMicPublishForTarget = useCallback(async (nextTargetIdentity) => {
    if (!isGroup) {
      await setLocalMicPublish(true);
      return;
    }

    await setLocalMicPublish(Boolean(nextTargetIdentity) && nextTargetIdentity === myIdentityRef.current);
  }, [isGroup, setLocalMicPublish]);

  function addLog(type, text) {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        text,
        timestamp: formatLogTime(),
      },
      ...prev,
    ]);
  }

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
  const isUnderTen = answerExpiresAt != null && answerTimer.secondsLeft <= WARNING_THRESHOLD && answerTimer.secondsLeft > 0;

  // 진행 바 비율
  const answerProgress = answerExpiresAt != null
    ? Math.min(100, Math.max(0, (answerTimer.secondsLeft / answerTimeLimitSeconds) * 100))
    : 0;
  const totalProgress = totalDurationSeconds > 0
    ? Math.min(100, Math.max(0, (interviewTimer.secondsLeft / totalDurationSeconds) * 100))
    : 0;

  useEffect(() => {
    if (answerTimer.secondsLeft === WARNING_THRESHOLD && answerTimer.secondsLeft > 0) {
      setWarningVisible(true);
      addLog("ALERT", "10초 후 답변이 종료됩니다.");
    }
    if (answerTimer.secondsLeft > WARNING_THRESHOLD) {
      setWarningVisible(false);
    }
  }, [answerTimer.secondsLeft]);

  const handleDataReceived = useCallback((payload) => {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload));
      if (msg.type === "NEXT") {
        const { turnNumber } = msg.payload || {};
        if (typeof turnNumber === "number") updateTurn(turnNumber);
        void setLocalMicPublish(false);
        setCurrentQuestion("");
        setWaitingForAgent(false);
        setAgentTimedOut(false);
        setWarningVisible(false);
        setAnswerExpiresAt(null);
        setTargetIdentity(null);
        setCurrentTurnRole("ai");
        addLog("SYSTEM", `다음 질문을 준비 중입니다. (Q${turnNumber ?? turnRef.current})`);
        return;
      }

      if (msg.type === "PARTICIPANT_LEFT") {
        const { identity } = msg.payload || {};
        if (identity && identity !== myIdentityRef.current) {
          addLog("SYSTEM", `${identity} 님이 면접에서 나갔습니다.`);
        }
        return;
      }

      if (msg.type === "QUESTION") {
        const { turnNumber, text, targetIdentity: target } = msg.payload || {};
        if (typeof turnNumber === "number" && turnNumber !== turnRef.current) {
          console.warn(`[InterviewRoom] 턴 번호 불일치: client=${turnRef.current}, agent=${turnNumber}.`);
          addLog("WARN", `턴 번호 불일치 감지 (서버=${turnRef.current}, 면접관=${turnNumber}). 면접관 값으로 갱신합니다.`);
          updateTurn(turnNumber);
        }
        setTargetIdentity(target || null);
        const isMyTurn = !target || !myIdentity || target === myIdentity;
        setCurrentQuestion(text);
        setWaitingForAgent(false);
        setWarningVisible(false);
        if (isMyTurn) {
          setAnswerExpiresAt(Date.now() + answerTimeLimitSeconds * 1000);
          setCurrentTurnRole("user");
        } else {
          setAnswerExpiresAt(null);
          setCurrentTurnRole("waiting");
          addLog("SYSTEM", `답변 차례: ${target}`);
        }
        syncMicPublishForTarget(target);
        addLog("AI", `Q${turnNumber}. ${text}`);
      }
    } catch (e) {
      // 파싱 실패 시 무시
    }
  }, [answerTimeLimitSeconds, syncMicPublishForTarget, updateTurn, myIdentity, setLocalMicPublish]);

  useEffect(() => {
    if (session.livekit?.isMock) {
      setIsConnected(true);
      setWaitingForAgent(false);
      setCurrentQuestion("최근 프로젝트에서 가장 어려웠던 기술 의사결정 사례를 설명해주세요.");
      setCurrentTurnRole("user");
      return undefined;
    }

    const room = new Room();
    roomRef.current = room;

    async function connectRoom() {
      try {
        await room.connect(session.livekit.url, session.livekit.accessToken);
        setLocalIdentity(room.localParticipant.identity);
        myIdentityRef.current = session.myIdentity || room.localParticipant.identity;
        await setLocalMicPublish(!isGroup);
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
        if (participant.identity?.startsWith("user-")) {
          addLog("USER", `참가자 음성 연결: ${participant.identity}`);
        } else {
          setCurrentTurnRole("ai");
        }
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === "audio") track.detach().forEach((el) => el.remove());
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

  const isHost = session.role === "HOST";

  const requestNextQuestion = async () => {
    if (!currentQuestion || !isMyActiveTurn || !canAskNextQuestion || ending) return;
    if (!nextGuard.tryAcquire()) return;
    setNextLoading(true);
    await setLocalMicPublish(false);
    setCurrentTurnRole("ai");
    // 다음 질문이 발화될 때까지 화면을 "대기" 상태로 (질문 텍스트 비우고 타이머 --:--)
    setCurrentQuestion("");
    setAnswerExpiresAt(null);
    setWarningVisible(false);

    try {
      const response = await nextQuestion(session.sessionId, turnRef.current);
      const data = response?.data ?? response ?? {};

      if (typeof data.turnNumber === "number") updateTurn(data.turnNumber);
      if (session.livekit?.isMock) {
        setCurrentQuestion(`Mock 질문 ${data.turnNumber}: 다음 질문입니다.`);
        setCurrentTurnRole("user");

        let nextDeadline = Date.now() + answerTimeLimitSeconds * 1000;
        if (data.expiresAt) {
          const parsed = new Date(data.expiresAt).getTime();
          const ms = parsed - Date.now();
          if (ms > EXPIRES_AT_FALLBACK_THRESHOLD_MS) {
            nextDeadline = parsed;
          } else {
            console.warn(`[InterviewRoom] 비정상 expiresAt 수신 (남은 ms=${ms}).`);
            addLog("WARN", `서버 타이머가 비정상입니다. 답변 시간을 ${answerTimeLimitSeconds}초로 재설정했습니다.`);
          }
        }
        setAnswerExpiresAt(nextDeadline);
      }
      // 실제 모드: 답변 타이머는 Agent의 QUESTION 데이터 메시지 수신 시
      // handleDataReceived 에서 expiresAt 을 설정하므로 여기서는 건드리지 않는다.
      addLog("SYSTEM", `다음 질문을 요청했습니다. (턴 ${data.turnNumber})`);
    } catch (err) {
      addLog("SYSTEM", `다음 질문 요청 실패: ${err.message}`);
      // 실패 시에는 답변을 계속 받을 수 있도록 타이머 복구
      setAnswerExpiresAt(Date.now() + answerTimeLimitSeconds * 1000);
    } finally {
      setNextLoading(false);
      nextGuard.release();
    }
  };

  useEffect(() => {
    if (!canAskNextQuestion && answerTimer.secondsLeft === 0 && !ending) {
      onSessionEnd("TIME_OVER");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAskNextQuestion, answerTimer.secondsLeft, ending, isGroup, isHost]);

  // 게스트: 호스트가 면접 종료·평가 후 본인 피드백 자동 수신
  useEffect(() => {
    if (!isGroup || isHost || !session?.sessionId || !onGuestFeedbackReady) return undefined;

    let disposed = false;
    const poll = async () => {
      try {
        const response = await getInterviewResult(session.sessionId);
        if (disposed || response?.pending || !response?.data) return;
        roomRef.current?.disconnect();
        onGuestFeedbackReady(response.data);
      } catch {
        // 평가 전 — 무시하고 재시도
      }
    };

    const intervalId = window.setInterval(poll, 8000);
    poll();
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [isGroup, isHost, session?.sessionId, onGuestFeedbackReady]);

  const toggleMic = async () => {
    if (session.livekit?.isMock) { setIsMicOn((prev) => !prev); return; }
    if (!roomRef.current) return;
    if (isGroup && (!targetIdentity || targetIdentity !== myIdentity || !currentQuestion || currentTurnRole !== "user")) {
      await setLocalMicPublish(false);
      return;
    }
    const next = !isMicOn;
    await setLocalMicPublish(next);
  };

  const endInterview = async () => {
    if (isGroup && isHost) {
      const ok = window.confirm(
        "면접을 종료하면 모든 참가자의 평가가 시작됩니다. 종료하시겠습니까?"
      );
      if (!ok) return;
      roomRef.current?.disconnect();
      await onSessionEnd("USER_STOP");
      return;
    }

    if (isGroup && !isHost) {
      const ok = window.confirm(
        "지금 나가면 현재까지의 답변으로 개인 피드백을 생성합니다.\n" +
          "남은 참가자의 면접은 계속 진행됩니다.\n" +
          "그래도 나가시겠습니까?"
      );
      if (!ok) return;
      roomRef.current?.disconnect();
      await onSessionLeave?.();
      return;
    }

    roomRef.current?.disconnect();
    await onSessionEnd("USER_STOP");
  };

  // ── 대기 화면 ──────────────────────────────────────────────
  if (waitingForAgent && !session.livekit?.isMock) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-[0_4px_20px_rgba(15,40,100,.08)] p-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-1">Session</p>
              <h2 className="text-xl font-bold text-slate-900">AI 면접관 대기 중</h2>
            </div>
            <Badge variant={isConnected ? "default" : "warning"}>
              {isConnected ? "연결됨" : "연결 확인 중"}
            </Badge>
          </div>

          {agentTimedOut ? (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700 flex flex-col gap-3">
              <p>{connectionError}</p>
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
                새로고침
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-slate-500">AI 면접관이 접속할 때까지 기다리고 있습니다...</p>
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 font-mono space-y-1">
            <p><span className="text-slate-400">Session</span> {session.sessionId}</p>
            <p><span className="text-slate-400">Room</span> {session.livekit.roomName}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── 메인 면접 화면: View 에 props 주입 ────────────────────
  const visibleLogs = logs.filter((l) => !HIDDEN_LOG_TYPES.has(l.type));

  // 배경 블롭 ambient 상태.
  // 현재 데이터 모델에서는 LLM 생성 / TTS 발화 구분이 불가능 (INTEGRATION_CONTRACT §3.5
  // 에 따라 텍스트는 TTS 종료 후 한 번에 도착) 이므로 두 단계를 generating 으로 통합한다.
  // 추후 LiveKit ActiveSpeakers 감지로 speaking 분리 시 이 곳만 수정하면 된다.
  const ambientState = currentTurnRole === "ai" ? "generating" : "answering";

  return (
    <InterviewRoomView
      isConnected={isConnected}
      sessionId={session.sessionId}
      totalTimeRemaining={interviewTimer.formatted}
      totalTimeProgress={totalProgress}

      questionNumber={turn}
      questionText={currentQuestion}
      currentTurn={currentTurnRole}

      answerTimeRemaining={answerTimer.formatted}
      answerTimeProgress={answerProgress}
      isUnderTen={isUnderTen}
      showAnswerTimer={answerExpiresAt != null}

      warningVisible={warningVisible}
      errorMessage=""

      isMicOn={isMicOn}
      isMicToggleDisabled={Boolean(
        isGroup &&
        (!targetIdentity || targetIdentity !== myIdentity || !currentQuestion || currentTurnRole !== "user")
      )}
      onToggleMic={toggleMic}
      onNextQuestion={requestNextQuestion}
      onEndInterview={endInterview}
      isHost={isHost}
      canAskNext={
        Boolean(currentQuestion) &&
        isMyActiveTurn &&
        canAskNextQuestion
      }
      targetIdentity={targetIdentity}
      myIdentity={myIdentity}
      isGroup={isGroup}
      nextLoading={nextLoading}
      ending={ending}

      eventLog={visibleLogs}

      ambientState={ambientState}
    />
  );
}

function formatLogTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
