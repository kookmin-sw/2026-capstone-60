import CompetencyRadarChart from "./CompetencyRadarChart";

export default function ResultView({ result, onRestart, onOpenHistory }) {
  // 백엔드 FeedbackResponse 구조: totalFeedback, overallScore(상/중/하), competencyChart(JSON), qaPairs[]
  const overallScore = result.overallScore || "N/A";
  const level = overallScore === "상" ? "우수" : overallScore === "중" ? "보통" : "보완 필요";

  // competencyChart 파싱: {"유형명": 점수, ...}
  let chartData = {};
  try {
    chartData = typeof result.competencyChart === "string"
      ? JSON.parse(result.competencyChart)
      : result.competencyChart || {};
  } catch {
    chartData = {};
  }

  return (
    <div className="result-layout">
      <section className="card">
        <p className="eyebrow">Interview Result</p>
        <h2>종합 피드백</h2>
        <div className="score-chip">종합 평가: {overallScore}</div>
        <p className="subtext compact">현재 레벨: {level}</p>
        <p className="subtext" style={{ whiteSpace: "pre-wrap", marginTop: "1rem" }}>
          {result.totalFeedback}
        </p>
      </section>

      <section className="card">
        <CompetencyRadarChart chartData={chartData} />
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
          {result.qaPairs?.map((qa) => (
            <article key={qa.sequenceNumber} className="qa-item">
              <h4>Q{qa.sequenceNumber}. {qa.questionContent}</h4>
              <p>
                <strong>내 답변:</strong> {qa.answerContent || "답변 없음"}
              </p>
              <p>
                <strong>모범 답안:</strong> {qa.modelAnswer}
              </p>
              <p>
                <strong>피드백:</strong> {qa.individualFeedback}
              </p>
              {qa.isFollowUp && <span className="chip warn">질문 {qa.parentSequenceNumber ?? (qa.sequenceNumber - 1)}번의 꼬리질문입니다.</span>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
