function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export default function HistoryListView({ loading, records, onSelectRecord }) {
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
          <article key={record.id} className="history-item">
            <div>
              <strong>{record.jobField || "직무 미지정"} 면접</strong>
              <p className="subtext compact">
                점수 {record.score ?? "-"} · {record.durationMinutes ?? "-"}분 ·{" "}
                {formatDate(record.createdAt)}
              </p>
            </div>
            <button className="ghost-btn" type="button" onClick={() => onSelectRecord(record.id)}>
              상세 보기
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
