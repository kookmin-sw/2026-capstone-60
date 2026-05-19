export default function EvaluatingView({ sessionId, polling }) {
  const steps = [
    "질문/답변 로그 정리",
    "LLM 기반 답변 품질 분석",
    "모범 답안 및 종합 피드백 생성",
  ];

  return (
    <section className="card evaluating-card">
      <p className="eyebrow">AI Evaluation</p>
      <h2>면접을 분석하는 중입니다</h2>
      <p className="subtext">
        세션 ID <strong>{sessionId}</strong>의 답변을 기반으로 종합 피드백과 모범 답안을
        생성하고 있습니다.
      </p>
      <div className="spinner-wrap">
        <div className="spinner" />
        <span>{polling ? "결과를 확인하는 중..." : "잠시만 기다려주세요..."}</span>
      </div>
      <div className="step-list">
        {steps.map((step) => (
          <p key={step}>- {step}</p>
        ))}
      </div>
    </section>
  );
}
