import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { deleteMe, fetchMe, login, logout, signup, updateMe } from "./api/authApi";
import ApiTestPage from "./components/ApiTestPage";
import {
  deleteInterviewRecord,
  fetchInterviewRecordDetail,
  fetchInterviewRecords,
  saveInterviewRecord,
} from "./api/interviewHistoryApi";
import EvaluatingView from "./components/EvaluatingView";
import HomeView from "./components/HomeView";
import HistoryDetailView from "./components/HistoryDetailView";
import HistoryListView from "./components/HistoryListView";
import InterviewRoom from "./components/InterviewRoom";
import JoinInterviewView from "./components/JoinInterviewView";
import LobbyView from "./components/LobbyView";
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
  leaveInterviewSession,
  triggerEvaluation,
  nextQuestion,
} from "./api/interviewApi";

const ROUTE = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  MYPAGE: "/mypage",
  API_TEST: "/api-test",
  SETUP: "/interview/setup",
  LOBBY: "/interview/lobby",
  JOIN: "/interview/join",
  ROOM: "/interview/room",
  EVALUATING: "/interview/evaluating",
  RESULT: "/interview/result",
  HISTORY: "/history",
};

function loginUrlWithRedirect(pathname) {
  const safePath =
    pathname && pathname.startsWith("/") && !pathname.startsWith("//")
      ? pathname
      : ROUTE.HOME;
  return `${ROUTE.LOGIN}?redirect=${encodeURIComponent(safePath)}`;
}

function resolveRedirectTarget(search) {
  const redirect = new URLSearchParams(search).get("redirect");
  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }
  return ROUTE.HOME;
}

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
      navigate(loginUrlWithRedirect(location.pathname), { replace: true });
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [navigate, location.pathname]);

  useEffect(() => {
    async function bootstrapAuth() {
      try {
        const profile = await fetchMe();
        setUser(profile);
        if (
          location.pathname === ROUTE.LOGIN &&
          new URLSearchParams(location.search).has("redirect")
        ) {
          navigate(resolveRedirectTarget(location.search), { replace: true });
        } else if (location.pathname === ROUTE.LOGIN || location.pathname === ROUTE.SIGNUP) {
          navigate(ROUTE.HOME, { replace: true });
        }
      } catch {
        const protectedPaths = [
          ROUTE.SETUP,
          ROUTE.LOBBY,
          ROUTE.JOIN,
          ROUTE.ROOM,
          ROUTE.EVALUATING,
          ROUTE.RESULT,
          ROUTE.HISTORY,
          ROUTE.MYPAGE,
        ];
        if (protectedPaths.some((p) => location.pathname.startsWith(p))) {
          navigate(loginUrlWithRedirect(location.pathname), { replace: true });
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
      const redirect = new URLSearchParams(location.search).get("redirect");
      navigate(
        redirect
          ? `${ROUTE.LOGIN}?redirect=${encodeURIComponent(redirect)}`
          : ROUTE.LOGIN
      );
    } catch (signupError) {
      setError(signupError.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const buildSessionState = (data, payload, extras = {}) => ({
    sessionId: data.sessionId,
    jobField: payload?.jobField ?? extras.jobField,
    durationMinutes: payload?.durationMinutes ?? extras.durationMinutes,
    livekit: data.livekit,
    answerTimeLimitSeconds: data.answerTimeLimitSeconds || 90,
    totalDurationSeconds: data.totalDurationSeconds || (payload?.durationMinutes ?? 15) * 60,
    mode: data.mode || (data.maxParticipants > 1 ? "GROUP" : "SOLO"),
    maxParticipants: data.maxParticipants ?? 1,
    status: data.status,
    role: extras.role || "HOST",
    myIdentity: extras.myIdentity || (user?.id ? `user-${user.id}` : undefined),
  });

  const startSession = async (payload) => {
    try {
      setStartLoading(true);
      setError("");

      const isGroupMode = payload.mode === "GROUP" || (payload.maxParticipants ?? 1) > 1;
      const apiBody = {
        jobField: payload.jobField,
        durationMinutes: payload.durationMinutes,
      };
      if (payload.resumeIds) {
        apiBody.resumeIds = payload.resumeIds;
      }
      if (isGroupMode) {
        apiBody.maxParticipants = payload.maxParticipants ?? 2;
      }

      const response = await createInterviewSession(apiBody);
      const data = response.data;
      const sessionState = buildSessionState(data, payload, {
        role: "HOST",
        myIdentity: user?.id ? `user-${user.id}` : undefined,
      });
      setSession(sessionState);
      if (isGroupMode) {
        navigate(ROUTE.LOBBY);
      } else {
        navigate(ROUTE.ROOM);
      }
    } catch (sessionError) {
      setError(sessionError.message);
    } finally {
      setStartLoading(false);
    }
  };

  const handleEnterRoomFromLobby = (updatedSession) => {
    setSession((prev) => ({ ...prev, ...updatedSession }));
    navigate(ROUTE.ROOM);
  };

  const handleJoinedSession = (joinedSession) => {
    setSession({
      ...joinedSession,
      answerTimeLimitSeconds: 90,
      durationMinutes: joinedSession.durationMinutes ?? 15,
      totalDurationSeconds: joinedSession.totalDurationSeconds ?? 15 * 60,
      jobField: joinedSession.jobField ?? "BACKEND",
    });
  };

  const signIn = async (loginId, password) => {
    try {
      setAuthLoading(true);
      setError("");
      const authUser = await login(loginId, password);
      setUser(authUser);
      navigate(resolveRedirectTarget(location.search));
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

  const leaveSession = useCallback(
    async (options = {}) => {
      if (!session?.sessionId || ending) return;
      try {
        setEnding(true);
        setError("");
        await leaveInterviewSession(session.sessionId);
        setSession(null);
        if (options.showHistoryHint) {
          sessionStorage.setItem(
            "groupLeaveNotice",
            "호스트가 면접을 종료하면 「면접 기록」에서 본인 피드백을 확인할 수 있습니다."
          );
        }
        navigate(ROUTE.HOME);
      } catch (leaveError) {
        setError(leaveError.message);
      } finally {
        setEnding(false);
      }
    },
    [ending, navigate, session?.sessionId]
  );

  const handleGuestFeedbackReady = useCallback(
    (feedbackData) => {
      setResult(feedbackData);
      setSession((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev));
      navigate(ROUTE.RESULT);
    },
    [navigate]
  );

  const endSession = useCallback(
    async (reason) => {
      if (!session?.sessionId || ending) return;
      const isGroup = session.mode === "GROUP";
      const isHost = session.role === "HOST";

      if (isGroup && !isHost) {
        await leaveSession();
        return;
      }

      try {
        setEnding(true);
        setError("");
        await endInterviewSession(session.sessionId, reason);
        await triggerEvaluation(session.sessionId);
        navigate(ROUTE.EVALUATING);
      } catch (endError) {
        setError(endError.message);
      } finally {
        setEnding(false);
      }
    },
    [ending, session?.sessionId, session?.mode, session?.role, leaveSession]
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
      const records = await fetchInterviewRecords();
      setHistoryRecords(Array.isArray(records) ? records : []);
      navigate(ROUTE.HISTORY);
    } catch (historyError) {
      setError(historyError.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // /history 경로에서 새로고침 시 자동으로 목록 불러오기
  useEffect(() => {
    if (location.pathname === ROUTE.HISTORY && historyRecords.length === 0 && !historyLoading && user) {
      (async () => {
        try {
          setHistoryLoading(true);
          const records = await fetchInterviewRecords();
          setHistoryRecords(Array.isArray(records) ? records : []);
        } catch {
          // 조용히 실패
        } finally {
          setHistoryLoading(false);
        }
      })();
    }
  }, [location.pathname, user]);

  const openHistoryDetail = async (recordId) => {
    try {
      setHistoryDetailLoading(true);
      setError("");
      const response = await fetchInterviewRecordDetail(recordId);
      // 백엔드가 FeedbackResponse 객체를 직접 반환
      setHistoryDetail(response?.data || response || null);
      navigate(`${ROUTE.HISTORY}/${recordId}`);
    } catch (detailError) {
      setError(detailError.message);
    } finally {
      setHistoryDetailLoading(false);
    }
  };

  const handleDeleteRecord = async (sessionId) => {
    try {
      await deleteInterviewRecord(sessionId);
      setHistoryRecords((prev) => prev.filter((r) => r.sessionId !== sessionId));
    } catch (deleteError) {
      setError(deleteError.message || "면접 기록 삭제에 실패했습니다.");
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
      setHistoryDetail(response?.data || response || null);
    } catch (detailError) {
      setError(detailError.message);
    } finally {
      setHistoryDetailLoading(false);
    }
  }, []);

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
          path={ROUTE.LOBBY}
          element={
            user && session ? (
              <LobbyView
                session={session}
                onEnterRoom={handleEnterRoomFromLobby}
                onError={setError}
              />
            ) : (
              <Navigate to={ROUTE.SETUP} replace />
            )
          }
        />
        <Route
          path={`${ROUTE.JOIN}/:sessionId`}
          element={
            user ? (
              <JoinInterviewView
                user={user}
                onJoined={handleJoinedSession}
                onError={setError}
              />
            ) : (
              <Navigate to={loginUrlWithRedirect(location.pathname)} replace />
            )
          }
        />
        <Route
          path={ROUTE.ROOM}
          element={
            user && session ? (
              <InterviewRoom
                session={session}
                onSessionEnd={endSession}
                onSessionLeave={() => leaveSession({ showHistoryHint: true })}
                onGuestFeedbackReady={handleGuestFeedbackReady}
                ending={ending}
              />
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
                onDeleteRecord={handleDeleteRecord}
              />
            ) : (
              <Navigate to={ROUTE.LOGIN} replace />
            )
          }
        />
        <Route
          path={`${ROUTE.HISTORY}/:recordId`}
          element={
            user ? (
              <HistoryDetailView
                loading={historyDetailLoading}
                record={historyDetail}
                onBack={openHistory}
              />
            ) : (
              <Navigate to={ROUTE.LOGIN} replace />
            )
          }
        />
        <Route path={ROUTE.API_TEST} element={<ApiTestPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  };

  const isAuthPage =
    location.pathname === ROUTE.LOGIN || location.pathname === ROUTE.SIGNUP;
  const showNavActions = !isAuthPage && Boolean(user);
  const isInterviewRoom = location.pathname === ROUTE.ROOM;

  return (
    <>
      {!isInterviewRoom && (
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
      )}
      <main className={isInterviewRoom ? "interview-shell" : "app-shell"}>
        {isMockMode() && !isInterviewRoom && (
          <div className="mock-badge">Mock Mode — 백엔드 없이 단독 테스트 중</div>
        )}
        {error && !isInterviewRoom && <div className="global-error">{error}</div>}
        <section className={isInterviewRoom ? "" : "page-content"}>{renderContent()}</section>
      </main>
    </>
  );
}
