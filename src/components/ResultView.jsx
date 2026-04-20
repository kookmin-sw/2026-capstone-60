export default function ResultView({ result, onRestart, onOpenHistory }) {
  const score = Number(result.score) || 0;
  const level = score >= 85 ? "상" : score >= 70 ? "중" : "보완 필요";
  const technical = Math.min(100, score + 4);
  const logic = Math.max(50, score - 3);
  const depth = Math.max(45, score - 8);
  const communication = Math.min(100, score + 1);

  return (
    <div className="result-layout">
      <section className="card">
        <p className="eyebrow">Interview Result</p>
        <h2>종합 피드백</h2>
        <p className="subtext">{result.overallFeedback}</p>
        <div className="score-chip">점수 {result.score}점</div>
        <p className="subtext compact">현재 레벨: {level}</p>
      </section>

      <section className="card metric-grid">
        <article className="metric-item">
          <span>기술 정확성</span>
          <strong>{technical}</strong>
        </article>
        <article className="metric-item">
          <span>논리성</span>
          <strong>{logic}</strong>
        </article>
        <article className="metric-item">
          <span>깊이</span>
          <strong>{depth}</strong>
        </article>
        <article className="metric-item">
          <span>전달력</span>
          <strong>{communication}</strong>
        </article>
      </section>

      <section className="card">
        <div className="header-row">
          <h3>문답 분석</h3>
          <div className="inline-actions">
            <button className="ghost-btn" type="button" onClick={onOpenHistory}>
              면접 기록 보기
            </button>
            <button className="ghost-btn" type="button" onClick={onRestart}>
              새 면접 시작
            </button>
          </div>
        </div>

        <div className="qa-list">
          {result.qaList?.map((qa) => (
            <article key={qa.turn} className="qa-item">
              <h4>Q{qa.turn}. {qa.question}</h4>
              <p>
                <strong>내 답변:</strong> {qa.userAnswer}
              </p>
              <p>
                <strong>추천 답변:</strong> {qa.bestAnswer}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
