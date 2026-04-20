function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export default function HistoryDetailView({ loading, record, onBack }) {
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
          <div className="detail-meta">
            <p>
              <strong>세션 ID</strong> {record.sessionId}
            </p>
            <p>
              <strong>직무</strong> {record.jobField || "-"}
            </p>
            <p>
              <strong>면접 시간</strong> {record.durationMinutes ?? "-"}분
            </p>
            <p>
              <strong>생성 일시</strong> {formatDate(record.createdAt)}
            </p>
          </div>

          <section className="panel">
            <h3>종합 평가</h3>
            <p className="subtext">{record.result?.overallFeedback}</p>
            <div className="score-chip">점수 {record.result?.score ?? "-"}점</div>
          </section>

          <section className="panel">
            <h3>질문별 분석</h3>
            <div className="qa-list">
              {record.result?.qaList?.map((qa) => (
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
        </>
      )}
    </section>
  );
}
