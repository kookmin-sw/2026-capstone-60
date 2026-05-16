import CompetencyRadarChart from "./CompetencyRadarChart.jsx";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export default function HistoryDetailView({ loading, record, onBack }) {
  // record는 FeedbackResponse 구조: {success, totalFeedback, overallScore, competencyChart, qaPairs}
  let chartData = {};
  try {
    chartData = typeof record?.competencyChart === "string"
      ? JSON.parse(record.competencyChart)
      : record?.competencyChart || {};
  } catch {
    chartData = {};
  }

  return (
    <section className="card history-card">
      <div className="header-row">
        <div>
          <p className="eyebrow">Interview Detail</p>
          <h2>면접 기록 상세</h2>
        </div>
        <button className="ghost-btn" type="button" onClick={onBack}>
          목록으로
        </button>
      </div>

      {loading && <p className="subtext">상세 데이터를 불러오는 중입니다...</p>}
      {!loading && !record && <p className="subtext">표시할 상세 데이터가 없습니다.</p>}

      {!loading && record && (
        <>
          <section className="panel">
            <h3>종합 평가</h3>
            <div className="score-chip">종합 평가: {record.overallScore || "-"}</div>
            <p className="subtext" style={{ whiteSpace: "pre-wrap" }}>
              {record.totalFeedback}
            </p>
          </section>

          {Object.keys(chartData).length > 0 && (
            <section className="panel">
              <CompetencyRadarChart chartData={chartData} />
            </section>
          )}

          <section className="panel">
            <h3>질문별 분석</h3>
            <div className="qa-list">
              {record.qaPairs?.map((qa) => (
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
        </>
      )}
    </section>
  );
}
