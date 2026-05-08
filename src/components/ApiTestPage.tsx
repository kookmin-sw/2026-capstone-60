import axios, { AxiosError, AxiosResponse } from 'axios';
import { ReactNode, useEffect, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════
   axios instance
════════════════════════════════════════════════════════ */
const BASE_URL = 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

/* ═══════════════════════════════════════════════════════
   Types
════════════════════════════════════════════════════════ */
interface ApiResult {
  httpStatus: number;
  data: unknown;
  ok: boolean;
  timestamp: string;
}

/* ═══════════════════════════════════════════════════════
   Request runner
════════════════════════════════════════════════════════ */
async function runRequest(fn: () => Promise<AxiosResponse>): Promise<ApiResult> {
  const timestamp = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  try {
    const res = await fn();
    return { httpStatus: res.status, data: res.data, ok: true, timestamp };
  } catch (err) {
    const e = err as AxiosError;
    return {
      httpStatus: e.response?.status ?? 0,
      data: e.response?.data ?? { message: e.message },
      ok: false,
      timestamp,
    };
  }
}

/* ═══════════════════════════════════════════════════════
   Custom hook — per-section state
════════════════════════════════════════════════════════ */
function useSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const execute = async (fn: () => Promise<AxiosResponse>): Promise<ApiResult> => {
    setLoading(true);
    try {
      const res = await runRequest(fn);
      setResult(res);
      return res;
    } finally {
      setLoading(false);
    }
  };

  return { loading, result, execute };
}

/* ═══════════════════════════════════════════════════════
   UI helpers
════════════════════════════════════════════════════════ */
const METHOD_COLOR: Record<string, string> = {
  GET: '#16a34a',
  POST: '#2563eb',
  PUT: '#d97706',
  DELETE: '#dc2626',
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      style={{
        background: METHOD_COLOR[method] ?? '#64748b',
        color: '#fff',
        fontSize: 11,
        fontWeight: 800,
        padding: '3px 10px',
        borderRadius: 5,
        letterSpacing: '.06em',
        flexShrink: 0,
      }}
    >
      {method}
    </span>
  );
}

function AuthBadge({ required }: { required: boolean }) {
  return (
    <span
      style={{
        background: required ? '#fef9c3' : '#f1f5f9',
        color: required ? '#854d0e' : '#64748b',
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 5,
        flexShrink: 0,
      }}
    >
      {required ? '🔒 인증 필요' : '🔓 인증 불필요'}
    </span>
  );
}

function ResponsePanel({ result }: { result: ApiResult | null }) {
  if (!result) return null;
  return (
    <div
      style={{
        marginTop: 10,
        background: result.ok ? '#f0fdf4' : '#fff1f2',
        border: `1.5px solid ${result.ok ? '#86efac' : '#fca5a5'}`,
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: result.ok ? '#16a34a' : '#dc2626',
          }}
        >
          {result.ok ? '✅ 성공' : '❌ 에러'} — HTTP {result.httpStatus}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
          {result.timestamp}
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.65,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: '#1e293b',
          fontFamily: '"Fira Code", Consolas, "Courier New", monospace',
          background: 'rgba(255,255,255,.55)',
          borderRadius: 6,
          padding: '10px 12px',
        }}
      >
        {JSON.stringify(result.data, null, 2)}
      </pre>
    </div>
  );
}

interface SectionProps {
  title: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  authRequired: boolean;
  hint?: string;
  children: ReactNode;
}

function Section({ title, method, path, authRequired, hint, children }: SectionProps) {
  return (
    <div className="card" style={{ display: 'grid', gap: 14 }}>
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
        >
          <MethodBadge method={method} />
          <code
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#1e293b',
              fontFamily: 'Consolas, "Courier New", monospace',
              background: '#f1f5f9',
              padding: '3px 10px',
              borderRadius: 5,
            }}
          >
            {path}
          </code>
          <AuthBadge required={authRequired} />
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h3>
        {hint && (
          <p className="subtext" style={{ marginTop: 4 }}>
            {hint}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SendButton({
  loading,
  onClick,
  label = '요청 전송',
  danger = false,
  disabled = false,
}: {
  loading: boolean;
  onClick: () => void;
  label?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={danger ? 'danger-btn' : 'primary-btn'}
      onClick={onClick}
      disabled={loading || disabled}
      style={{ justifySelf: 'start' }}
    >
      {loading ? (
        <>
          <span className="spin-icon" />
          요청 중...
        </>
      ) : (
        label
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════
   ApiTestPage — main component
════════════════════════════════════════════════════════ */
export default function ApiTestPage() {
  /* ── global state ── */
  const [token, setToken] = useState('');
  const [sessionId, setSessionId] = useState('');
  const tokenRef = useRef('');

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  /* axios request interceptor: attach Bearer token */
  useEffect(() => {
    const interceptorId = apiClient.interceptors.request.use((config) => {
      if (tokenRef.current) {
        config.headers.Authorization = `Bearer ${tokenRef.current}`;
      }
      return config;
    });
    return () => apiClient.interceptors.request.eject(interceptorId);
  }, []);

  /* ── section hooks (one per API endpoint) ── */
  const sSignup         = useSection();
  const sLogin          = useSection();
  const sGetMe          = useSection();
  const sUpdateMe       = useSection();
  const sDeleteMe       = useSection();
  const sCreateSession  = useSection();
  const sEndSession     = useSection();

  /* ── form state ── */
  // [1] signup
  const [suId,   setSuId]   = useState('testuser01');
  const [suPw,   setSuPw]   = useState('test1234');
  const [suName, setSuName] = useState('테스트 사용자');

  // [2] login
  const [liId, setLiId] = useState('testuser01');
  const [liPw, setLiPw] = useState('test1234');

  // [4] update me
  const [umName,  setUmName]  = useState('');
  const [umCurPw, setUmCurPw] = useState('');
  const [umNewPw, setUmNewPw] = useState('');

  // [5] delete me
  const [dmPw, setDmPw] = useState('');

  // [6] create session
  const [csField,    setCsField]    = useState('백엔드 개발');
  const [csDuration, setCsDuration] = useState('30');

  // [7] end session
  const [esReason,    setEsReason]    = useState<'USER_STOP' | 'TIME_OVER'>('USER_STOP');
  const [esManualSid, setEsManualSid] = useState('');

  /* ── handlers ── */
  const handleSignup = async () => {
    await sSignup.execute(() =>
      apiClient.post('/v1/auth/signup', {
        loginId: suId,
        password: suPw,
        name: suName,
      }),
    );
  };

  const handleLogin = async () => {
    const res = await sLogin.execute(() =>
      apiClient.post('/v1/auth/login', { loginId: liId, password: liPw }),
    );
    if (res.ok) {
      const t = (res.data as { data?: { accessToken?: string } })?.data?.accessToken;
      if (t) {
        setToken(t);
        // pre-fill login fields into other forms for convenience
        setLiId(liId);
      }
    }
  };

  const handleGetMe = async () => {
    await sGetMe.execute(() => apiClient.get('/v1/auth/me'));
  };

  const handleUpdateMe = async () => {
    const body: Record<string, string> = {};
    if (umName)  body.name            = umName;
    if (umCurPw) body.currentPassword = umCurPw;
    if (umNewPw) body.newPassword     = umNewPw;
    await sUpdateMe.execute(() => apiClient.put('/v1/auth/me', body));
  };

  const handleDeleteMe = async () => {
    const res = await sDeleteMe.execute(() =>
      apiClient.delete('/v1/auth/me', { data: { password: dmPw } }),
    );
    if (res.ok) {
      setToken('');
      setSessionId('');
    }
  };

  const handleCreateSession = async () => {
    const res = await sCreateSession.execute(() =>
      apiClient.post('/v1/interviews/sessions', {
        jobField: csField,
        durationMinutes: parseInt(csDuration, 10),
        resumeIds: null,
        coverLetter: null,
      }),
    );
    if (res.ok) {
      const sid = (res.data as { data?: { sessionId?: string } })?.data?.sessionId;
      if (sid) setSessionId(sid);
    }
  };

  const handleEndSession = async () => {
    const sid = sessionId || esManualSid;
    if (!sid) return;
    await sEndSession.execute(() =>
      apiClient.post(`/v1/interviews/sessions/${sid}/end`, { reason: esReason }),
    );
  };

  const handleClearAll = () => {
    setToken('');
    setSessionId('');
  };

  /* ── derived ── */
  const tokenPreview = token ? `${token.slice(0, 28)}…` : null;

  /* ── render ── */
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin-icon {
          display: inline-block;
          width: 12px; height: 12px;
          border: 2px solid rgba(255,255,255,.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin .6s linear infinite;
        }
        .api-test-grid {
          display: grid;
          gap: 18px;
          max-width: 780px;
          margin: 0 auto;
          padding-top: 8px;
        }
        .api-status-bar {
          position: sticky;
          top: 68px;
          z-index: 50;
          background: rgba(15, 23, 42, 0.94);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px;
          padding: 12px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .api-status-label {
          font-size: 11px;
          font-weight: 800;
          color: #7dd3fc;
          letter-spacing: .10em;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .api-status-items {
          flex: 1;
          display: flex;
          gap: 14px;
          align-items: center;
          flex-wrap: wrap;
        }
        .api-status-item {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .api-status-key {
          font-size: 10px;
          font-weight: 700;
          color: #94a3b8;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .api-status-val {
          font-size: 11px;
          font-family: 'Fira Code', Consolas, monospace;
          padding: 2px 9px;
          border-radius: 4px;
        }
        .api-status-val.token  { background: #1e293b; color: #4ade80; }
        .api-status-val.sid    { background: #1e293b; color: #818cf8; }
        .api-status-val.empty  { color: #f87171; font-weight: 700; font-family: inherit; }
        .api-clear-btn {
          background: rgba(239,68,68,.15) !important;
          color: #f87171 !important;
          border: 1px solid rgba(239,68,68,.3) !important;
          border-radius: 7px !important;
          padding: 5px 14px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          cursor: pointer;
          box-shadow: none !important;
          transform: none !important;
          flex-shrink: 0;
        }
        .api-clear-btn:hover:not(:disabled) {
          background: rgba(239,68,68,.25) !important;
          transform: none !important;
        }
        .api-form-grid { display: grid; gap: 10px; }
        .api-sid-saved {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 10px 14px;
        }
        .api-sid-saved-tag {
          font-size: 11px;
          font-weight: 700;
          color: #16a34a;
          flex-shrink: 0;
        }
        .api-sid-saved-code {
          font-size: 12px;
          color: #166534;
          font-family: Consolas, monospace;
          word-break: break-all;
        }
        .api-section-divider {
          border: none;
          border-top: 2px dashed #e0eafc;
          margin: 4px 0 2px;
        }
        .api-scenario-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #2563eb;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 3px 10px;
          letter-spacing: .02em;
          margin-bottom: 6px;
        }
      `}</style>

      <div className="api-test-grid">

        {/* ════════════════════ STATUS BAR ════════════════════ */}
        <div className="api-status-bar">
          <span className="api-status-label">API Tester</span>
          <div className="api-status-items">
            {/* Token */}
            <div className="api-status-item">
              <span className="api-status-key">Token</span>
              {tokenPreview ? (
                <span className="api-status-val token">{tokenPreview}</span>
              ) : (
                <span className="api-status-val empty">미로그인</span>
              )}
            </div>
            {/* SessionId */}
            <div className="api-status-item">
              <span className="api-status-key">Session</span>
              {sessionId ? (
                <span className="api-status-val sid">{sessionId.slice(0, 22)}…</span>
              ) : (
                <span className="api-status-val empty">없음</span>
              )}
            </div>
          </div>
          {(token || sessionId) && (
            <button className="api-clear-btn" type="button" onClick={handleClearAll}>
              토큰·세션 초기화
            </button>
          )}
        </div>

        {/* ═══════════════ SCENARIO A — 회원가입·로그인·조회 ═══════════════ */}
        <div className="api-scenario-tag">🅐 시나리오 A — 회원가입 → 로그인 → 내 정보 조회</div>

        {/* [1] Signup */}
        <Section
          title="회원가입"
          method="POST"
          path="/v1/auth/signup"
          authRequired={false}
          hint="loginId는 고유값이며 최대 50자입니다. 중복 시 409 CONFLICT 응답."
        >
          <div className="api-form-grid">
            <Field label="loginId (필수, 최대 50자)">
              <input
                value={suId}
                onChange={(e) => setSuId(e.target.value)}
                placeholder="user123"
              />
            </Field>
            <Field label="password (필수)">
              <input
                type="password"
                value={suPw}
                onChange={(e) => setSuPw(e.target.value)}
                placeholder="비밀번호"
              />
            </Field>
            <Field label="name (필수, 최대 50자)">
              <input
                value={suName}
                onChange={(e) => setSuName(e.target.value)}
                placeholder="홍길동"
              />
            </Field>
          </div>
          <SendButton loading={sSignup.loading} onClick={handleSignup} label="회원가입 요청" />
          <ResponsePanel result={sSignup.result} />
        </Section>

        {/* [2] Login */}
        <Section
          title="로그인"
          method="POST"
          path="/v1/auth/login"
          authRequired={false}
          hint="로그인 성공 시 accessToken이 상단 상태 표시줄에 자동 저장되어 이후 모든 인증 요청에 자동 첨부됩니다."
        >
          <div className="api-form-grid">
            <Field label="loginId (필수)">
              <input
                value={liId}
                onChange={(e) => setLiId(e.target.value)}
                placeholder="user123"
              />
            </Field>
            <Field label="password (필수)">
              <input
                type="password"
                value={liPw}
                onChange={(e) => setLiPw(e.target.value)}
                placeholder="비밀번호"
              />
            </Field>
          </div>
          <SendButton loading={sLogin.loading} onClick={handleLogin} label="로그인" />
          <ResponsePanel result={sLogin.result} />
        </Section>

        {/* [3] Get Me */}
        <Section
          title="내 정보 조회"
          method="GET"
          path="/v1/auth/me"
          authRequired={true}
          hint="저장된 토큰이 Authorization: Bearer <token> 헤더에 자동 첨부됩니다."
        >
          <SendButton loading={sGetMe.loading} onClick={handleGetMe} label="내 정보 조회" />
          <ResponsePanel result={sGetMe.result} />
        </Section>

        <hr className="api-section-divider" />

        {/* ═══════════════ SCENARIO B — 정보 수정 ═══════════════ */}
        <div className="api-scenario-tag">🅑 시나리오 B — 회원 정보 수정</div>

        {/* [4] Update Me */}
        <Section
          title="회원 정보 수정"
          method="PUT"
          path="/v1/auth/me"
          authRequired={true}
          hint="변경할 항목만 입력하세요. newPassword 전송 시 currentPassword는 필수. 비어있는 필드는 요청 body에서 제외됩니다."
        >
          <div className="api-form-grid">
            <Field label="name (선택 — 이름만 변경할 때 입력)">
              <input
                value={umName}
                onChange={(e) => setUmName(e.target.value)}
                placeholder="새로운 이름"
              />
            </Field>
            <Field label="currentPassword (비밀번호 변경 시 필수)">
              <input
                type="password"
                value={umCurPw}
                onChange={(e) => setUmCurPw(e.target.value)}
                placeholder="현재 비밀번호"
              />
            </Field>
            <Field label="newPassword (선택)">
              <input
                type="password"
                value={umNewPw}
                onChange={(e) => setUmNewPw(e.target.value)}
                placeholder="새 비밀번호"
              />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
            <span>💡 빠른 테스트:</span>
            <button
              type="button"
              className="ghost-btn"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => { setUmName('수정된이름'); setUmCurPw(''); setUmNewPw(''); }}
            >
              이름만 수정
            </button>
            <button
              type="button"
              className="ghost-btn"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => { setUmName(''); setUmCurPw(liPw); setUmNewPw('newpass123'); }}
            >
              비밀번호만 수정
            </button>
            <button
              type="button"
              className="ghost-btn"
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => { setUmName('동시수정이름'); setUmCurPw(liPw); setUmNewPw('newpass123'); }}
            >
              이름+비밀번호 동시 수정
            </button>
          </div>
          <SendButton loading={sUpdateMe.loading} onClick={handleUpdateMe} label="수정 요청" />
          <ResponsePanel result={sUpdateMe.result} />
        </Section>

        <hr className="api-section-divider" />

        {/* ═══════════════ SCENARIO C — 면접 세션 ═══════════════ */}
        <div className="api-scenario-tag">🅒 시나리오 C — 면접 세션</div>

        {/* [6] Create Session */}
        <Section
          title="면접 세션 생성"
          method="POST"
          path="/v1/interviews/sessions"
          authRequired={true}
          hint="세션 생성 성공 시 sessionId가 상단 상태 표시줄에 자동 저장되어 세션 종료 시 자동 사용됩니다."
        >
          <div className="api-form-grid">
            <Field label="jobField (필수 — 직무 분야, 자유 문자열)">
              <input
                value={csField}
                onChange={(e) => setCsField(e.target.value)}
                placeholder="백엔드 개발"
              />
            </Field>
            <Field label="durationMinutes (필수 — 면접 시간, 분 단위 정수)">
              <input
                type="number"
                value={csDuration}
                onChange={(e) => setCsDuration(e.target.value)}
                placeholder="30"
                min="1"
              />
            </Field>
          </div>
          <SendButton loading={sCreateSession.loading} onClick={handleCreateSession} label="세션 생성" />
          <ResponsePanel result={sCreateSession.result} />
        </Section>

        {/* [7] End Session */}
        <Section
          title="면접 세션 종료"
          method="POST"
          path="/v1/interviews/sessions/{sessionId}/end"
          authRequired={true}
          hint="세션 생성 후 sessionId가 자동 저장됩니다. 직접 입력도 가능합니다."
        >
          <div className="api-form-grid">
            <div>
              <p className="field" style={{ gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
                  sessionId (Path Variable)
                </span>
              </p>
              {sessionId ? (
                <div className="api-sid-saved">
                  <span className="api-sid-saved-tag">✅ 자동 저장됨</span>
                  <code className="api-sid-saved-code">{sessionId}</code>
                </div>
              ) : (
                <input
                  value={esManualSid}
                  onChange={(e) => setEsManualSid(e.target.value)}
                  placeholder="세션 ID를 직접 입력하세요 (예: sess-abc123...)"
                />
              )}
            </div>
            <Field label="reason (필수)">
              <select
                value={esReason}
                onChange={(e) => setEsReason(e.target.value as 'USER_STOP' | 'TIME_OVER')}
              >
                <option value="USER_STOP">USER_STOP — 사용자가 직접 종료</option>
                <option value="TIME_OVER">TIME_OVER — 시간 초과로 자동 종료</option>
              </select>
            </Field>
          </div>
          <SendButton
            loading={sEndSession.loading}
            onClick={handleEndSession}
            label="세션 종료"
            disabled={!sessionId && !esManualSid}
          />
          <ResponsePanel result={sEndSession.result} />
        </Section>

        <hr className="api-section-divider" />

        {/* ═══════════════ SCENARIO D — 에러 케이스 ═══════════════ */}
        <div className="api-scenario-tag">🅓 시나리오 D — 에러 케이스 검증</div>

        <div
          className="card"
          style={{ display: 'grid', gap: 10, background: '#fffbeb', borderColor: '#fde68a' }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#92400e' }}>
            에러 케이스 빠른 테스트
          </h3>
          <p className="subtext">아래 버튼으로 각 에러 시나리오를 빠르게 트리거할 수 있습니다.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ghost-btn"
              style={{ fontSize: 12 }}
              onClick={() => {
                setSuId(suId);
                sSignup.execute(() =>
                  apiClient.post('/v1/auth/signup', { loginId: suId, password: suPw, name: suName }),
                );
              }}
            >
              409 — 중복 아이디로 재가입
            </button>
            <button
              type="button"
              className="ghost-btn"
              style={{ fontSize: 12 }}
              onClick={() => {
                sLogin.execute(() =>
                  apiClient.post('/v1/auth/login', { loginId: liId, password: 'wrongpassword!' }),
                );
              }}
            >
              401 — 잘못된 비밀번호로 로그인
            </button>
            <button
              type="button"
              className="ghost-btn"
              style={{ fontSize: 12 }}
              onClick={async () => {
                const saved = token;
                setToken('');
                await sGetMe.execute(() => apiClient.get('/v1/auth/me'));
                setToken(saved);
              }}
            >
              401 — 토큰 없이 /me 호출
            </button>
            <button
              type="button"
              className="ghost-btn"
              style={{ fontSize: 12 }}
              onClick={() => {
                sDeleteMe.execute(() =>
                  apiClient.delete('/v1/auth/me', { data: {} }),
                );
              }}
            >
              400 — password 없이 탈퇴 시도
            </button>
          </div>
          <div style={{ display: 'grid', gap: 0 }}>
            {sSignup.result && <ResponsePanel result={sSignup.result} />}
            {sLogin.result && <ResponsePanel result={sLogin.result} />}
            {sGetMe.result && <ResponsePanel result={sGetMe.result} />}
            {sDeleteMe.result && <ResponsePanel result={sDeleteMe.result} />}
          </div>
        </div>

        <hr className="api-section-divider" />

        {/* ═══════════════ SCENARIO E — 회원 탈퇴 ═══════════════ */}
        <div className="api-scenario-tag">🅔 시나리오 E — 회원 탈퇴</div>

        {/* [5] Delete Me */}
        <Section
          title="회원 탈퇴"
          method="DELETE"
          path="/v1/auth/me"
          authRequired={true}
          hint="탈퇴 성공 시 저장된 accessToken과 sessionId가 자동으로 초기화됩니다."
        >
          <Field label="password (필수 — 본인 확인용 현재 비밀번호)">
            <input
              type="password"
              value={dmPw}
              onChange={(e) => setDmPw(e.target.value)}
              placeholder="현재 비밀번호 입력"
            />
          </Field>
          <SendButton
            loading={sDeleteMe.loading}
            onClick={handleDeleteMe}
            label="탈퇴 요청"
            danger
          />
          <ResponsePanel result={sDeleteMe.result} />
        </Section>

        {/* bottom padding */}
        <div style={{ height: 32 }} />
      </div>
    </>
  );
}
