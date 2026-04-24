export default function HomeView({ user, onStartInterview, onLogin, onOpenHistory }) {
  return (
    <section className="card home-card">
      <p className="eyebrow">AI Mock Interview</p>
      <h1>실전처럼 연습하는 AI 모의면접</h1>
      <p className="subtext">
        면접을 바로 시작하기 전에 직무와 시간을 설정하고, 완료 후 피드백 리포트까지 확인해보세요.
      </p>

      <div className="home-actions">
        {user ? (
          <>
            <button className="primary-btn" type="button" onClick={onStartInterview}>
              면접 시작하기
            </button>
            <button className="ghost-btn" type="button" onClick={onOpenHistory}>
              이전 면접 기록 보기
            </button>
          </>
        ) : (
          <button className="primary-btn" type="button" onClick={onLogin}>
            로그인하고 시작하기
          </button>
        )}
      </div>
    </section>
  );
}
