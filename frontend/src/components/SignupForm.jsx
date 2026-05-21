import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function SignupForm({ onSignup, loading }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState("");
  const navigate = useNavigate();

  const submit = (event) => {
    event.preventDefault();
    setLocalError("");

    if (password !== passwordConfirm) {
      setLocalError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (loginId.length > 50 || name.length > 50) {
      setLocalError("아이디와 이름은 50자 이내로 입력해 주세요.");
      return;
    }

    onSignup(loginId.trim(), password, name.trim());
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <div>
          <p className="eyebrow">AI 모의면접</p>
          <h1>회원가입</h1>
          <p className="subtext" style={{ marginTop: 6 }}>
            아이디, 비밀번호, 이름을 입력해 주세요.
          </p>
        </div>

        {localError && <p className="form-error">{localError}</p>}

        <label className="field">
          <span>아이디</span>
          <input
            type="text"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="영문/숫자, 최대 50자"
            autoComplete="username"
            maxLength={50}
            required
          />
        </label>

        <label className="field">
          <span>이름</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            maxLength={50}
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
            autoComplete="new-password"
            required
          />
        </label>

        <label className="field">
          <span>비밀번호 확인</span>
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder="비밀번호를 다시 입력하세요"
            autoComplete="new-password"
            required
          />
        </label>

        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "가입 중..." : "회원가입"}
        </button>

        <p className="auth-footer-text">
          이미 계정이 있으신가요?{" "}
          <button
            type="button"
            className="link-btn"
            onClick={() => navigate("/login")}
          >
            로그인
          </button>
        </p>
      </form>
    </div>
  );
}
