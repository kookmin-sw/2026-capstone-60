import { useEffect, useState } from "react";
import FortuneCookie from "./FortuneCookie";

export default function HomeView({ user, onStartInterview, onLogin, onOpenHistory }) {
  const [leaveNotice, setLeaveNotice] = useState("");

  useEffect(() => {
    const notice = sessionStorage.getItem("groupLeaveNotice");
    if (notice) {
      setLeaveNotice(notice);
      sessionStorage.removeItem("groupLeaveNotice");
    }
  }, []);

  return (
    <div className="home-card">
      {leaveNotice && (
        <div className="notice" style={{ marginBottom: "1rem" }}>
          {leaveNotice}
          {user && (
            <button
              type="button"
              className="ghost-btn"
              style={{ marginLeft: "0.75rem" }}
              onClick={onOpenHistory}
            >
              면접 기록 보기
            </button>
          )}
        </div>
      )}
      <div className="home-hero">
        <p className="eyebrow">Realtime AI Mock Interview</p>
        <h1>실전처럼 연습하는<br />AI 모의면접</h1>
        <p className="hero-sub">
          직무를 설정하고 음성으로 답변하면, AI가 꼬리 질문과 함께<br />
          종합 피드백 리포트를 제공합니다.
        </p>
        <div className="home-actions">
          {user ? (
            <>
              <button className="primary-btn" type="button" onClick={onStartInterview}>
                면접 시작하기
              </button>
              <button className="ghost-btn" type="button" onClick={onOpenHistory}>
                이전 기록 보기
              </button>
            </>
          ) : (
            <button className="primary-btn" type="button" onClick={onLogin}>
              로그인하고 시작하기
            </button>
          )}
        </div>
      </div>

      <div className="feature-grid">
        <div className="feature-card mint">
          <div className="feature-icon">🎙️</div>
          <h3>실시간 음성 면접</h3>
          <p>
            LiveKit 기반 실시간 음성 연결로 실제 면접과 동일한 환경을 경험합니다.
          </p>
        </div>
        <div className="feature-card purple">
          <div className="feature-icon">🤖</div>
          <h3>RAG 기반 질문 생성</h3>
          <p>
            이력서와 자소서를 분석해 직무에 꼭 맞는 맞춤 질문과 꼬리 질문을 생성합니다.
          </p>
        </div>
        <div className="feature-card pink">
          <div className="feature-icon">📊</div>
          <h3>AI 피드백 리포트</h3>
          <p>
            면접 종료 후 기술 정확성·논리성·전달력 지표와 모범 답안을 자동으로 제공합니다.
          </p>
        </div>
      </div>

      {/* Fortune Cookie */}
      <div className="fortune-section">
        <FortuneCookie />
      </div>
    </div>
  );
}
