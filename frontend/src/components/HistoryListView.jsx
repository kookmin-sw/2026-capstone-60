function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export default function HistoryListView({ loading, records, onSelectRecord, onDeleteRecord }) {
  return (
    <section className="card history-card">
      <div className="header-row">
        <div>
          <p className="eyebrow">My Interviews</p>
          <h2>누적 면접 기록</h2>
        </div>
      </div>

      {loading && <p className="subtext">면접 기록을 불러오는 중입니다...</p>}
      {!loading && records.length === 0 && (
        <p className="subtext">아직 저장된 면접 기록이 없습니다.</p>
      )}

      <div className="history-list">
        {records.map((record) => (
          <article key={record.sessionId} className="history-item">
            <div>
              <strong>{record.category || "직무 미지정"} 면접</strong>
              <p className="subtext compact">
                Score: {record.overallScore ?? "-"} · {formatDate(record.createdAt)}
              </p>
            </div>
            <div className="inline-actions">
              <button className="ghost-btn" type="button" onClick={() => onSelectRecord(record.sessionId)}>
                상세 보기
              </button>
              {onDeleteRecord && (
                <button
                  className="ghost-btn"
                  type="button"
                  style={{ color: "var(--red-700, #c00)" }}
                  onClick={() => {
                    if (window.confirm("이 면접 기록을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.")) {
                      onDeleteRecord(record.sessionId);
                    }
                  }}
                >
                  삭제
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
