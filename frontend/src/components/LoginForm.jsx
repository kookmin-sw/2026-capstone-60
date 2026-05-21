import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function LoginForm({ onLogin, loading }) {
  const [searchParams] = useSearchParams();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const submit = (event) => {
    event.preventDefault();
    onLogin(loginId.trim(), password);
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <div>
          <p className="eyebrow">AI 모의면접</p>
          <h1>로그인</h1>
          <p className="subtext" style={{ marginTop: 6 }}>
            아이디와 비밀번호를 입력해 주세요.
          </p>
        </div>

        <label className="field">
          <span>아이디</span>
          <input
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="아이디를 입력하세요"
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            autoComplete="current-password"
            required
          />
        </label>

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </button>

        <p className="auth-footer-text">
          계정이 없으신가요?{" "}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              const redirect = searchParams.get("redirect");
              navigate(
                redirect
                  ? `/signup?redirect=${encodeURIComponent(redirect)}`
                  : "/signup"
              );
            }}
          >
            회원가입
          </button>
        </p>
      </form>
    </div>
  );
}
