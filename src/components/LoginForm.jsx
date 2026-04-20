import { useState } from "react";

export default function LoginForm({ onLogin, loading }) {
  const [email, setEmail] = useState("demo@interview.ai");
  const [password, setPassword] = useState("demo1234");

  const submit = (event) => {
    event.preventDefault();
    onLogin(email.trim(), password);
  };

  return (
    <form className="card auth-card" onSubmit={submit}>
      <p className="eyebrow">JWT Authentication</p>
      <h1>로그인</h1>
      <p className="subtext">
        인증이 완료되면 JWT를 저장하고 인터뷰 API 호출 시 Bearer 토큰을 자동 첨부합니다.
      </p>

      <label className="field">
        <span>이메일</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>

      <label className="field">
        <span>비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      <button className="primary-btn" type="submit" disabled={loading}>
        {loading ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
