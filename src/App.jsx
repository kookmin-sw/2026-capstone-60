import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { deleteMe, fetchMe, login, logout, signup, updateMe } from "./api/authApi";
import ApiTestPage from "./components/ApiTestPage";
import {
  fetchInterviewRecordDetail,
  fetchInterviewRecords,
  saveInterviewRecord,
} from "./api/interviewHistoryApi";
import EvaluatingView from "./components/EvaluatingView";
import HomeView from "./components/HomeView";
import HistoryDetailView from "./components/HistoryDetailView";
import HistoryListView from "./components/HistoryListView";
import InterviewRoom from "./components/InterviewRoom";
import LoginForm from "./components/LoginForm";
import MyPage from "./components/MyPage";
import ResultView from "./components/ResultView";
import SessionSetupForm from "./components/SessionSetupForm";
import SignupForm from "./components/SignupForm";
import {
  createInterviewSession,
  endInterviewSession,
  getInterviewResult,
  isMockMode,
  nextQuestion,
} from "./api/interviewApi";

const ROUTE = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  MYPAGE: "/mypage",
  API_TEST: "/api-test",
  SETUP: "/interview/setup",
  ROOM: "/interview/room",
  EVALUATING: "/interview/evaluating",
  RESULT: "/interview/result",
  HISTORY: "/history",
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [bootstrapping, setBootstrapping] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 401 응답 시 자동 로그아웃 및 로그인 페이지 이동
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setError("");
      setSession(null);
      setResult(null);
      setHistoryRecords([]);
      setHistoryDetail(null);
      navigate(ROUTE.LOGIN, { replace: true });
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [navigate]);

  useEffect(() => {
    async function bootstrapAuth() {
      try {
        const profile = await fetchMe();
        setUser(profile);
        if (location.pathname === ROUTE.LOGIN || location.pathname === ROUTE.SIGNUP) {
          navigate(ROUTE.HOME, { replace: true });
        }
      } catch {
        const protectedPaths = [
          ROUTE.SETUP,
          ROUTE.ROOM,
          ROUTE.EVALUATING,
          ROUTE.RESULT,
          ROUTE.HISTORY,
          ROUTE.MYPAGE,
        ];
        if (protectedPaths.some((p) => location.pathname.startsWith(p))) {
          navigate(ROUTE.LOGIN, { replace: true });
        }
      } finally {
        setBootstrapping(false);
      }
    }
    bootstrapAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (loginId, password, name) => {
    try {
      setAuthLoading(true);
      setError("");
      await signup(loginId, password, name);
      navigate(ROUTE.LOGIN);
    } catch (signupError) {
      setError(signupError.message);
    } finally {
      setAuthLoading(false);
    }
  };

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
        answerTimeLimitSeconds: data.answerTimeLimitSeconds || 90,
        totalDurationSeconds: data.totalDurationSeconds || payload.durationMinutes * 60,
      });
      navigate(ROUTE.ROOM);
    } catch (sessionError) {
      setError(sessionError.message);
    } finally {
      setStartLoading(false);
    }
  };

  const signIn = async (loginId, password) => {
    try {
      setAuthLoading(true);
      setError("");
      const authUser = await login(loginId, password);
      setUser(authUser);
      navigate(ROUTE.HOME);
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
    navigate(ROUTE.HOME);
  };

  const handleUpdateMe = async (fields) => {
    setUpdating(true);
    try {
      const updated = await updateMe(fields);
      setUser((prev) => ({ ...prev, ...updated }));
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteMe = async (password) => {
    setDeleting(true);
    try {
      await deleteMe(password);
      setUser(null);
      setSession(null);
      setResult(null);
      setHistoryRecords([]);
      setHistoryDetail(null);
      navigate(ROUTE.LOGIN);
    } finally {
      setDeleting(false);
    }
  };

  const endSession = useCallback(
    async (reason) => {
      if (!session?.sessionId || ending) return;
      try {
        setEnding(true);
        setError("");
        await endInterviewSession(session.sessionId, reason);
        navigate(ROUTE.EVALUATING);
      } catch (endError) {
        setError(endError.message);
      } finally {
        setEnding(false);
      }
    },
    [ending, session?.sessionId]
  );

  useEffect(() => {
    if (location.pathname !== ROUTE.EVALUATING || !session?.sessionId) return undefined;

    let disposed = false;
    setPolling(true);
    const intervalId = window.setInterval(async () => {
      try {
        const response = await getInterviewResult(session.sessionId);
        if (disposed || response?.pending || !response?.data) return;
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
        navigate(ROUTE.RESULT);
      } catch (pollError) {
        if (disposed) return;
        if (pollError?.code === "EVALUATING" || pollError?.status === 202) return;
        setError(
          pollError?.message ||
            "평가 결과 조회 중 일시적인 오류가 발생했습니다. 자동으로 재시도합니다."
        );
      }
    }, 4000);

    return () => {
      disposed = true;
      setPolling(false);
      window.clearInterval(intervalId);
    };
  }, [
    location.pathname,
    navigate,
    session?.durationMinutes,
    session?.jobField,
    session?.sessionId,
  ]);

  const openHistory = async () => {
    try {
      setHistoryLoading(true);
      setError("");
      const response = await fetchInterviewRecords();
      setHistoryRecords(response?.data || []);
      navigate(ROUTE.HISTORY);
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
      navigate(`${ROUTE.HISTORY}/${recordId}`);
    } catch (detailError) {
      setError(detailError.message);
    } finally {
      setHistoryDetailLoading(false);
    }
  };

  const reset = () => {
    setSession(null);
    setResult(null);
    setError("");
    setEnding(false);
    setPolling(false);
    navigate(ROUTE.SETUP);
  };

  const openHistoryDetailById = useCallback(async (recordId) => {
    try {
      setHistoryDetailLoading(true);
      setError("");
      const response = await fetchInterviewRecordDetail(recordId);
      setHistoryDetail(response?.data || null);
    } catch (detailError) {
      setError(detailError.message);
    } finally {
      setHistoryDetailLoading(false);
    }
  }, []);

  const HistoryDetailRoute = () => {
    const { recordId } = useParams();

    useEffect(() => {
      if (!recordId) return;
      openHistoryDetailById(recordId);
    }, [recordId, openHistoryDetailById]);

    return (
      <HistoryDetailView
        loading={historyDetailLoading}
        record={historyDetail}
        onBack={openHistory}
      />
    );
  };

  const renderContent = () => {
    if (bootstrapping) {
      return (
        <section className="card">
          <p className="subtext">세션 정보를 확인 중입니다...</p>
        </section>
      );
    }

    return (
      <Routes>
        <Route
          path={ROUTE.HOME}
          element={
            <HomeView
              user={user}
              onStartInterview={() => navigate(ROUTE.SETUP)}
              onLogin={() => navigate(ROUTE.LOGIN)}
              onOpenHistory={openHistory}
            />
          }
        />
        <Route
          path={ROUTE.LOGIN}
          element={
            user ? (
              <Navigate to={ROUTE.HOME} replace />
            ) : (
              <LoginForm onLogin={signIn} loading={authLoading} />
            )
          }
        />
        <Route
          path={ROUTE.SIGNUP}
          element={
            user ? (
              <Navigate to={ROUTE.HOME} replace />
            ) : (
              <SignupForm onSignup={signUp} loading={authLoading} />
            )
          }
        />
        <Route
          path={ROUTE.MYPAGE}
          element={
            user ? (
              <MyPage
                user={user}
                onUpdate={handleUpdateMe}
                onDelete={handleDeleteMe}
                updating={updating}
                deleting={deleting}
              />
            ) : (
              <Navigate to={ROUTE.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTE.SETUP}
          element={
            user ? (
              <SessionSetupForm onSubmit={startSession} isSubmitting={startLoading} />
            ) : (
              <Navigate to={ROUTE.LOGIN} replace />
            )
          }
        />
        <Route
          path={ROUTE.ROOM}
          element={
            user && session ? (
              <InterviewRoom session={session} onSessionEnd={endSession} ending={ending} />
            ) : (
              <Navigate to={ROUTE.SETUP} replace />
            )
          }
        />
        <Route
          path={ROUTE.EVALUATING}
          element={
            user && session ? (
              <EvaluatingView sessionId={session.sessionId} polling={polling} />
            ) : (
              <Navigate to={ROUTE.SETUP} replace />
            )
          }
        />
        <Route
          path={ROUTE.RESULT}
          element={
            user && result ? (
              <ResultView result={result} onRestart={reset} onOpenHistory={openHistory} />
            ) : (
              <Navigate to={ROUTE.SETUP} replace />
            )
          }
        />
        <Route
          path={ROUTE.HISTORY}
          element={
            user ? (
              <HistoryListView
                loading={historyLoading}
                records={historyRecords}
                onSelectRecord={openHistoryDetail}
              />
            ) : (
              <Navigate to={ROUTE.LOGIN} replace />
            )
          }
        />
        <Route
          path={`${ROUTE.HISTORY}/:recordId`}
          element={user ? <HistoryDetailRoute /> : <Navigate to={ROUTE.LOGIN} replace />}
        />
        <Route path={ROUTE.API_TEST} element={<ApiTestPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  };

  const isAuthPage =
    location.pathname === ROUTE.LOGIN || location.pathname === ROUTE.SIGNUP;
  const showNavActions = !isAuthPage && Boolean(user);

  return (
    <>
      <header className="app-header">
        <div className="nav-inner">
          <button className="nav-logo" type="button" onClick={() => navigate(ROUTE.HOME)}>
            AI<span>면접</span>
          </button>
          <div className="header-actions">
            {showNavActions && (
              <>
                <button
                  className={`nav-link ${location.pathname === ROUTE.HOME ? "is-active" : ""}`}
                  type="button"
                  onClick={() => navigate(ROUTE.HOME)}
                >
                  홈
                </button>
                <button
                  className={`nav-link ${
                    location.pathname.startsWith(ROUTE.SETUP) ||
                    location.pathname.startsWith(ROUTE.ROOM)
                      ? "is-active"
                      : ""
                  }`}
                  type="button"
                  onClick={reset}
                >
                  면접 시작
                </button>
                <button
                  className={`nav-link ${
                    location.pathname.startsWith(ROUTE.HISTORY) ? "is-active" : ""
                  }`}
                  type="button"
                  onClick={openHistory}
                >
                  면접 기록
                </button>
                <div className="nav-divider" />
              </>
            )}
            {user && (
              <button
                className={`chip success chip-btn ${
                  location.pathname === ROUTE.MYPAGE ? "is-active" : ""
                }`}
                type="button"
                onClick={() => navigate(ROUTE.MYPAGE)}
                title="마이페이지"
              >
                {user.name || user.loginId} 님
              </button>
            )}
            {showNavActions && (
              <button className="ghost-btn" type="button" onClick={signOut}>
                로그아웃
              </button>
            )}
            {!user && !isAuthPage && (
              <button
                className="primary-btn"
                type="button"
                onClick={() => navigate(ROUTE.LOGIN)}
              >
                로그인
              </button>
            )}
            <button
              className={`nav-link ${location.pathname === ROUTE.API_TEST ? "is-active" : ""}`}
              type="button"
              onClick={() => navigate(ROUTE.API_TEST)}
              title="API 테스트 페이지"
              style={{ fontSize: 12, color: "var(--slate-400)" }}
            >
              API Test
            </button>
          </div>
        </div>
      </header>
      <main className="app-shell">
        {isMockMode() && (
          <div className="mock-badge">Mock Mode — 백엔드 없이 단독 테스트 중</div>
        )}
        {error && <div className="global-error">{error}</div>}
        <section className="page-content">{renderContent()}</section>
      </main>
    </>
  );
}
