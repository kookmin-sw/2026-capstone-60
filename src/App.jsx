import { useCallback, useEffect, useState } from "react";
import { fetchMe, login, logout } from "./api/authApi";
import {
  fetchInterviewRecordDetail,
  fetchInterviewRecords,
  saveInterviewRecord,
} from "./api/interviewHistoryApi";
import EvaluatingView from "./components/EvaluatingView";
import HistoryDetailView from "./components/HistoryDetailView";
import HistoryListView from "./components/HistoryListView";
import InterviewRoom from "./components/InterviewRoom";
import LoginForm from "./components/LoginForm";
import ResultView from "./components/ResultView";
import SessionSetupForm from "./components/SessionSetupForm";
import {
  createInterviewSession,
  endInterviewSession,
  getInterviewResult,
  isMockMode,
} from "./api/interviewApi";

const SCREEN = {
  AUTH: "AUTH",
  READY: "READY",
  INTERVIEW: "INTERVIEW",
  EVALUATING: "EVALUATING",
  RESULT: "RESULT",
  HISTORY: "HISTORY",
  HISTORY_DETAIL: "HISTORY_DETAIL",
};

export default function App() {
  const [screen, setScreen] = useState(SCREEN.AUTH);
  const [session, setSession] = useState(null);
  const [result, setResult] = useState(null);
  const [startLoading, setStartLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [historyDetail, setHistoryDetail] = useState(null);

  useEffect(() => {
    async function bootstrapAuth() {
      try {
        const profile = await fetchMe();
        setUser(profile);
        setScreen(SCREEN.READY);
      } catch {
        setScreen(SCREEN.AUTH);
      }
    }
    bootstrapAuth();
  }, []);

  const startSession = async (payload) => {
    try {
      setStartLoading(true);
      setError("");
      const response = await createInterviewSession(payload);
      const data = response.data;
      setSession({
        sessionId: data.sessionId,
        jobField: payload.jobField,
        durationMinutes: payload.durationMinutes,
        livekit: data.livekit,
      });
      setScreen(SCREEN.INTERVIEW);
    } catch (sessionError) {
      setError(sessionError.message);
    } finally {
      setStartLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      setAuthLoading(true);
      setError("");
      const authUser = await login(email, password);
      setUser(authUser);
      setScreen(SCREEN.READY);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = () => {
    logout();
    setUser(null);
    setError("");
    setSession(null);
    setResult(null);
    setHistoryRecords([]);
    setHistoryDetail(null);
    setScreen(SCREEN.AUTH);
  };

  const endSession = useCallback(
    async (reason) => {
      if (!session?.sessionId || ending) return;
      try {
        setEnding(true);
        setError("");
        await endInterviewSession(session.sessionId, reason);
        setScreen(SCREEN.EVALUATING);
      } catch (endError) {
        setError(endError.message);
      } finally {
        setEnding(false);
      }
    },
    [ending, session?.sessionId]
  );

  useEffect(() => {
    if (screen !== SCREEN.EVALUATING || !session?.sessionId) return undefined;

    let disposed = false;
    setPolling(true);
    const intervalId = window.setInterval(async () => {
      try {
        const response = await getInterviewResult(session.sessionId);
        if (!response?.data || disposed) return;
        setResult(response.data);
        try {
          await saveInterviewRecord({
            sessionId: session.sessionId,
            jobField: session.jobField,
            durationMinutes: session.durationMinutes,
            result: response.data,
          });
        } catch {
          // 기록 저장 실패가 결과 화면 전환을 막지 않도록 분리 처리한다.
        }
        setScreen(SCREEN.RESULT);
      } catch {
        // 평가 중간 단계(404/processing)는 폴링으로 재시도한다.
      }
    }, 4000);

    return () => {
      disposed = true;
      setPolling(false);
      window.clearInterval(intervalId);
    };
  }, [screen, session?.durationMinutes, session?.jobField, session?.sessionId]);

  const openHistory = async () => {
    try {
      setHistoryLoading(true);
      setError("");
      const response = await fetchInterviewRecords();
      setHistoryRecords(response?.data || []);
      setScreen(SCREEN.HISTORY);
    } catch (historyError) {
      setError(historyError.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryDetail = async (recordId) => {
    try {
      setHistoryDetailLoading(true);
      setError("");
      const response = await fetchInterviewRecordDetail(recordId);
      setHistoryDetail(response?.data || null);
      setScreen(SCREEN.HISTORY_DETAIL);
    } catch (detailError) {
      setError(detailError.message);
    } finally {
      setHistoryDetailLoading(false);
    }
  };

  const reset = () => {
    setScreen(SCREEN.READY);
    setSession(null);
    setResult(null);
    setError("");
    setEnding(false);
    setPolling(false);
  };

  const renderContent = () => {
    if (screen === SCREEN.AUTH) {
      return <LoginForm onLogin={signIn} loading={authLoading} />;
    }

    if (screen === SCREEN.READY) {
      return <SessionSetupForm onSubmit={startSession} isSubmitting={startLoading} />;
    }

    if (screen === SCREEN.INTERVIEW && session) {
      return (
        <InterviewRoom
          session={session}
          onSessionEnd={endSession}
          ending={ending}
        />
      );
    }

    if (screen === SCREEN.EVALUATING && session) {
      return <EvaluatingView sessionId={session.sessionId} polling={polling} />;
    }

    if (screen === SCREEN.RESULT && result) {
      return <ResultView result={result} onRestart={reset} onOpenHistory={openHistory} />;
    }

    if (screen === SCREEN.HISTORY) {
      return (
        <HistoryListView
          loading={historyLoading}
          records={historyRecords}
          onSelectRecord={openHistoryDetail}
        />
      );
    }

    if (screen === SCREEN.HISTORY_DETAIL) {
      return (
        <HistoryDetailView
          loading={historyDetailLoading}
          record={historyDetail}
          onBack={openHistory}
        />
      );
    }

    return null;
  };

  return (
    <main className="app-shell">
      <div className="background-blur" />
      <header className="app-header">
        <div>
          <p className="eyebrow">Realtime Voice Interview</p>
          <strong>RAG 기반 AI 모의면접</strong>
        </div>
        <div className="header-actions">
          {screen !== SCREEN.AUTH && (
            <>
              <button
                className={`ghost-btn ${screen === SCREEN.READY ? "is-active" : ""}`}
                type="button"
                onClick={reset}
              >
                면접 시작
              </button>
              <button
                className={`ghost-btn ${
                  screen === SCREEN.HISTORY || screen === SCREEN.HISTORY_DETAIL
                    ? "is-active"
                    : ""
                }`}
                type="button"
                onClick={openHistory}
              >
                면접 기록
              </button>
            </>
          )}
          {user && <span className="chip success">{user.name || user.email} 님</span>}
          {screen !== SCREEN.AUTH && (
            <button className="ghost-btn" type="button" onClick={signOut}>
              로그아웃
            </button>
          )}
        </div>
      </header>
      {isMockMode() && (
        <div className="mock-badge">Mock Mode: 백엔드 없이 단독 테스트 중</div>
      )}
      {error && <div className="global-error">{error}</div>}
      {renderContent()}
    </main>
  );
}
