import { Fragment, useEffect, useRef, useState } from "react";
import { uploadPdfResume } from "../api/resumeApi";

const JOB_FIELDS = [
  { value: "BACKEND",  label: "백엔드" },
  { value: "FRONTEND", label: "프론트엔드" },
  { value: "ANDROID",  label: "안드로이드" },
  { value: "IOS",      label: "iOS" },
  { value: "DEVOPS",   label: "DevOps" },
  { value: "DATA",     label: "데이터" },
  { value: "AI",       label: "AI / ML" },
];

const DURATION_OPTIONS = [10, 15, 20, 30, 45, 60];

const DOC_STORAGE_KEY = "interviewDocuments";

function formatSize(bytes) {
  if (!bytes) return "0 KB";
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const STEPS = [
  { id: 1, label: "문서 업로드",   skippable: true },
  { id: 2, label: "면접 설정",     skippable: false },
  { id: 3, label: "마이크 테스트", skippable: true },
  { id: 4, label: "시작 확인",     skippable: false },
];

export default function SessionSetupForm({ onSubmit, isSubmitting }) {
  const [step, setStep] = useState(1);

  /* ── Documents ────────────────────────────── */
  const [documents, setDocuments]               = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [selectedCoverId, setSelectedCoverId]   = useState("");
  const [uploadType, setUploadType]             = useState("RESUME");
  const [uploadFile, setUploadFile]             = useState(null);
  const [customTitle, setCustomTitle]           = useState("");

  /* ── Interview settings ───────────────────── */
  const [jobField, setJobField]               = useState("BACKEND");
  const [durationMinutes, setDurationMinutes] = useState(15);

  /* ── Mic ─────────────────────────────────── */
  const [audioPermission, setAudioPermission] = useState("idle");
  const [isTestingMic, setIsTestingMic]       = useState(false);
  const [audioLevel, setAudioLevel]           = useState(0);
  const [audioDetected, setAudioDetected]     = useState(false);
  const [micPassed, setMicPassed]             = useState(false);
  const [agreeRule, setAgreeRule]             = useState(false);
  const [micSkipped, setMicSkipped]           = useState(false);

  const streamRef        = useRef(null);
  const contextRef       = useRef(null);
  const animationRef     = useRef(null);
  const testStartedAtRef = useRef(0);
  const maxLevelRef      = useRef(0);

  /* ── Load / persist documents ─────────────── */
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(DOC_STORAGE_KEY) || "[]");
      if (Array.isArray(stored)) setDocuments(stored);
    } catch { setDocuments([]); }
  }, []);

  useEffect(() => {
    localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    const resumes = documents.filter((d) => d.type === "RESUME");
    const covers  = documents.filter((d) => d.type === "COVER_LETTER");
    if (resumes.length > 0 && !resumes.some((d) => String(d.id) === selectedResumeId))
      setSelectedResumeId(String(resumes[0].id));
    if (covers.length > 0 && !covers.some((d) => String(d.id) === selectedCoverId))
      setSelectedCoverId(String(covers[0].id));
    if (resumes.length === 0) setSelectedResumeId("");
    if (covers.length  === 0) setSelectedCoverId("");
  }, [documents, selectedResumeId, selectedCoverId]);

  /* cleanup mic on unmount */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => stopMicTest(false), []);

  const resumeDocs = documents.filter((d) => d.type === "RESUME");
  const coverDocs  = documents.filter((d) => d.type === "COVER_LETTER");

  /* ── Document helpers ─────────────────────── */
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const uploadDocument = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError("");

    const title = customTitle.trim() || uploadFile.name;

    try {
      // 백엔드에 PDF 업로드 → 파싱 → DB 저장
      const result = await uploadPdfResume(uploadFile, title);

      setDocuments((prev) => [
        {
          id: result.id,  // 백엔드에서 반환한 실제 DB ID
          type: uploadType,
          name: title,
          fileName: uploadFile.name,
          size: uploadFile.size || 0,
          uploadedAt: result.createdAt || new Date().toISOString(),
        },
        ...prev,
      ]);
      setUploadFile(null);
      setCustomTitle("");
    } catch (err) {
      setUploadError(err.message || "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  /* ── Mic helpers ──────────────────────────── */
  const startMicTest = async () => {
    try {
      setAudioPermission("requesting");
      setMicPassed(false);
      setAudioDetected(false);
      maxLevelRef.current = 0;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      streamRef.current = stream;
      contextRef.current = ctx;
      testStartedAtRef.current = Date.now();
      setAudioPermission("granted");
      setIsTestingMic(true);

      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const n = (data[i] - 128) / 128; sum += n * n; }
        const lvl = Math.sqrt(sum / data.length);
        maxLevelRef.current = Math.max(maxLevelRef.current, lvl);
        setAudioLevel(lvl);
        if (lvl > 0.02) setAudioDetected(true);
        animationRef.current = window.requestAnimationFrame(loop);
      };
      animationRef.current = window.requestAnimationFrame(loop);
    } catch {
      setAudioPermission("denied");
      stopMicTest(false);
    }
  };

  const stopMicTest = async (validate = true) => {
    if (animationRef.current) { window.cancelAnimationFrame(animationRef.current); animationRef.current = null; }
    if (streamRef.current)    { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (contextRef.current)   { await contextRef.current.close(); contextRef.current = null; }
    setIsTestingMic(false);
    if (!validate) return;
    setMicPassed(Date.now() - testStartedAtRef.current >= 2000 && maxLevelRef.current > 0.02);
  };

  /* ── Navigation ───────────────────────────── */
  const goNext = () => setStep((s) => Math.min(STEPS.length, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));
  const skipStep = () => {
    if (step === 3) setMicSkipped(true);
    goNext();
  };

  const handleSubmit = () => {
    onSubmit({
      resumeIds: selectedResumeId ? Number(selectedResumeId) : null,
      coverLetter: selectedCoverId ? Number(selectedCoverId) : null,
      jobField,
      durationMinutes: Number(durationMinutes),
    });
  };

  /* ── Step content ─────────────────────────── */
  const Step1 = (
    <div className="step-body">
      <div className="step-desc">
        <h2>이력서 / 자소서 업로드</h2>
        <p className="subtext">
          문서를 업로드하면 RAG 기반으로 직무 맞춤 질문이 생성됩니다.
          없으면 <strong>건너뛰기</strong>를 눌러도 됩니다.
        </p>
      </div>

      <div className="panel">
        <div className="field-row">
          <label className="field">
            <span>문서 유형</span>
            <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
              <option value="RESUME">이력서</option>
              <option value="COVER_LETTER">자소서</option>
            </select>
          </label>
          <label className="field">
            <span>표시 이름 (선택)</span>
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="예: 백엔드 지원 자소서"
            />
          </label>
        </div>
        <div className="upload-row">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
          />
          <button className="ghost-btn" type="button" onClick={uploadDocument} disabled={!uploadFile || uploading}>
            {uploading ? "업로드 중..." : "추가"}
          </button>
        </div>
        {uploadError && <p className="subtext" style={{ color: "red" }}>{uploadError}</p>}
      </div>

      {documents.length > 0 && (
        <>
          <div className="doc-list">
            {documents.map((doc) => (
              <article key={doc.id} className="doc-item">
                <div>
                  <strong>{doc.name}</strong>
                  <p className="subtext compact">
                    {doc.type === "RESUME" ? "이력서" : "자소서"} · {doc.fileName} · {formatSize(doc.size)}
                  </p>
                </div>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => setDocuments((p) => p.filter((d) => d.id !== doc.id))}
                >
                  삭제
                </button>
              </article>
            ))}
          </div>

          <div className="field-row">
            <label className="field">
              <span>이력서 선택</span>
              <select value={selectedResumeId} onChange={(e) => setSelectedResumeId(e.target.value)}>
                <option value="">선택 안 함</option>
                {resumeDocs.map((d) => <option value={d.id} key={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>자소서 선택</span>
              <select value={selectedCoverId} onChange={(e) => setSelectedCoverId(e.target.value)}>
                <option value="">선택 안 함</option>
                {coverDocs.map((d) => <option value={d.id} key={d.id}>{d.name}</option>)}
              </select>
            </label>
          </div>
        </>
      )}
    </div>
  );

  const Step2 = (
    <div className="step-body">
      <div className="step-desc">
        <h2>면접 설정</h2>
        <p className="subtext">지원 직무와 면접 시간을 선택하세요.</p>
      </div>

      <label className="field">
        <span>지원 직무</span>
        <div className="job-grid">
          {JOB_FIELDS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`job-chip ${jobField === f.value ? "selected" : ""}`}
              onClick={() => setJobField(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </label>

      <label className="field">
        <span>면접 시간</span>
        <div className="duration-grid">
          {DURATION_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`duration-chip ${durationMinutes === d ? "selected" : ""}`}
              onClick={() => setDurationMinutes(d)}
            >
              {d}분
            </button>
          ))}
        </div>
      </label>

      <div className="info-box">
        💡 질문당 최대 <strong>1분 30초</strong> 답변 시간이 주어집니다.
      </div>
    </div>
  );

  const micStatusText = {
    idle:       "테스트 전",
    requesting: "권한 요청 중...",
    granted:    "권한 허용됨",
    denied:     "권한 거부 또는 장치 오류",
  }[audioPermission];

  const Step3 = (
    <div className="step-body">
      <div className="step-desc">
        <h2>마이크 테스트</h2>
        <p className="subtext">
          면접 시작 전 마이크가 정상 작동하는지 확인하세요.
          건너뛸 경우 면접 중 음성이 인식되지 않을 수 있습니다.
        </p>
      </div>

      <div className="mic-panel">
        <div className="mic-level-wrap">
          <div className="audio-meter">
            <div
              className="audio-meter-fill"
              style={{ width: `${Math.min(100, audioLevel * 900)}%` }}
            />
          </div>
          <p className="subtext compact">
            {micStatusText}
            {audioPermission === "granted" && (
              <> · 음성 감지: {audioDetected ? <span className="text-success">감지됨</span> : "대기 중"}</>
            )}
          </p>
        </div>

        <div className="audio-test-row">
          <button className="ghost-btn" type="button" onClick={startMicTest} disabled={isTestingMic}>
            {isTestingMic ? "테스트 중..." : "마이크 테스트 시작"}
          </button>
          <button className="ghost-btn" type="button" onClick={() => stopMicTest(true)} disabled={!isTestingMic}>
            완료
          </button>
        </div>

        {micPassed && (
          <div className="notice">
            마이크 정상 감지 완료
          </div>
        )}
        {audioPermission === "denied" && (
          <div className="notice warn">마이크 접근이 거부됐습니다. 브라우저 권한 설정을 확인하세요.</div>
        )}
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={agreeRule}
          onChange={(e) => setAgreeRule(e.target.checked)}
        />
        <span>질문당 최대 1분 30초 답변 제한 규칙을 확인했습니다.</span>
      </label>
    </div>
  );

  const selectedResume = resumeDocs.find((d) => String(d.id) === selectedResumeId);
  const selectedCover  = coverDocs.find((d) => String(d.id) === selectedCoverId);

  const Step4 = (
    <div className="step-body">
      <div className="step-desc">
        <h2>면접 시작 확인</h2>
        <p className="subtext">아래 설정을 확인하고 면접을 시작하세요.</p>
      </div>

      <div className="confirm-grid">
        <div className="confirm-item">
          <span>직무</span>
          <strong>{JOB_FIELDS.find((f) => f.value === jobField)?.label ?? jobField}</strong>
        </div>
        <div className="confirm-item">
          <span>면접 시간</span>
          <strong>{durationMinutes}분</strong>
        </div>
        <div className="confirm-item">
          <span>이력서</span>
          <strong>{selectedResume ? selectedResume.name : "없음"}</strong>
        </div>
        <div className="confirm-item">
          <span>자소서</span>
          <strong>{selectedCover ? selectedCover.name : "없음"}</strong>
        </div>
        <div className="confirm-item">
          <span>마이크 테스트</span>
          <strong className={micPassed ? "text-success" : micSkipped ? "text-warn" : ""}>
            {micPassed ? "완료" : micSkipped ? "건너뜀" : "미진행"}
          </strong>
        </div>
        <div className="confirm-item">
          <span>규칙 동의</span>
          <strong className={agreeRule ? "text-success" : "text-warn"}>
            {agreeRule ? "동의함" : "미동의"}
          </strong>
        </div>
      </div>

      {(micSkipped || !micPassed) && (
        <div className="notice warn">
          마이크 테스트를 완료하지 않았습니다. 음성이 인식되지 않을 수 있습니다.
        </div>
      )}
      {!agreeRule && (
        <div className="notice warn">답변 시간 제한 규칙에 동의해야 면접을 시작할 수 있습니다.</div>
      )}
    </div>
  );

  const stepContent = [Step1, Step2, Step3, Step4][step - 1];
  const meta = STEPS[step - 1];
  const isFirst = step === 1;
  const isLast  = step === STEPS.length;
  const canSubmit = agreeRule && !isSubmitting;

  return (
    <div className="wizard-card card">
      {/* ── Stepper ─────────────────────────── */}
      <div className="stepper">
        {STEPS.map((s, i) => (
          <Fragment key={s.id}>
            <div className={`stepper-step ${step === s.id ? "active" : ""} ${step > s.id ? "done" : ""}`}>
              <div className="stepper-circle">
                {step > s.id ? "✓" : s.id}
              </div>
              <span className="stepper-label">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`stepper-connector ${step > s.id ? "filled" : ""}`} />
            )}
          </Fragment>
        ))}
      </div>

      {/* ── Content ─────────────────────────── */}
      {stepContent}

      {/* ── Footer nav ──────────────────────── */}
      <div className="step-nav">
        <div>
          {!isFirst && (
            <button className="ghost-btn" type="button" onClick={goBack}>
              ← 이전
            </button>
          )}
        </div>
        <div className="step-nav-right">
          {meta.skippable && !isLast && (
            <button className="ghost-btn" type="button" onClick={skipStep}>
              건너뛰기
            </button>
          )}
          {isLast ? (
            <button
              className="primary-btn"
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? "세션 생성 중..." : "면접 시작"}
            </button>
          ) : (
            <button className="primary-btn" type="button" onClick={goNext}>
              다음 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
