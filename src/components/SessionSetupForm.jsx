import { useEffect, useRef, useState } from "react";

const JOB_FIELDS = ["BACKEND", "FRONTEND", "ANDROID", "IOS", "DEVOPS", "DATA", "AI"];
const DOC_STORAGE_KEY = "interviewDocuments";

function formatSize(bytes) {
  if (!bytes) return "0 KB";
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function SessionSetupForm({ onSubmit, isSubmitting }) {
  const [documents, setDocuments] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [selectedCoverLetterId, setSelectedCoverLetterId] = useState("");
  const [jobField, setJobField] = useState("BACKEND");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [uploadType, setUploadType] = useState("RESUME");
  const [uploadFile, setUploadFile] = useState(null);
  const [customTitle, setCustomTitle] = useState("");
  const [audioPermission, setAudioPermission] = useState("idle");
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioDetected, setAudioDetected] = useState(false);
  const [micTestChecked, setMicTestChecked] = useState(false);
  const [agreeRule, setAgreeRule] = useState(true);

  const streamRef = useRef(null);
  const contextRef = useRef(null);
  const animationRef = useRef(null);
  const testStartedAtRef = useRef(0);
  const maxLevelRef = useRef(0);

  useEffect(() => {
    const raw = localStorage.getItem(DOC_STORAGE_KEY);
    if (!raw) return;
    try {
      const stored = JSON.parse(raw);
      if (Array.isArray(stored)) {
        setDocuments(stored);
      }
    } catch {
      setDocuments([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DOC_STORAGE_KEY, JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    const resumeDocs = documents.filter((doc) => doc.type === "RESUME");
    const coverDocs = documents.filter((doc) => doc.type === "COVER_LETTER");

    if (resumeDocs.length > 0 && !resumeDocs.some((doc) => String(doc.id) === selectedResumeId)) {
      setSelectedResumeId(String(resumeDocs[0].id));
    }
    if (coverDocs.length > 0 && !coverDocs.some((doc) => String(doc.id) === selectedCoverLetterId)) {
      setSelectedCoverLetterId(String(coverDocs[0].id));
    }
    if (resumeDocs.length === 0) setSelectedResumeId("");
    if (coverDocs.length === 0) setSelectedCoverLetterId("");
  }, [documents, selectedCoverLetterId, selectedResumeId]);

  useEffect(
    () => () => {
      stopMicTest(false);
    },
    []
  );

  const resumeDocs = documents.filter((doc) => doc.type === "RESUME");
  const coverLetterDocs = documents.filter((doc) => doc.type === "COVER_LETTER");
  const canStartInterview =
    micTestChecked &&
    agreeRule &&
    !isSubmitting;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canStartInterview) return;
    onSubmit({
      resumeIds: selectedResumeId ? Number(selectedResumeId) : null,
      coverLetter: selectedCoverLetterId ? Number(selectedCoverLetterId) : null,
      jobField,
      durationMinutes: Number(durationMinutes),
    });
  };

  const uploadDocument = () => {
    if (!uploadFile) return;
    const doc = {
      id: Date.now(),
      type: uploadType,
      name: customTitle.trim() || uploadFile.name,
      fileName: uploadFile.name,
      size: uploadFile.size || 0,
      uploadedAt: new Date().toISOString(),
    };
    setDocuments((prev) => [doc, ...prev]);
    setUploadFile(null);
    setCustomTitle("");
  };

  const removeDocument = (targetId) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== targetId));
  };

  const startMicTest = async () => {
    try {
      setAudioPermission("requesting");
      setMicTestChecked(false);
      setAudioDetected(false);
      maxLevelRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      streamRef.current = stream;
      contextRef.current = context;
      testStartedAtRef.current = Date.now();
      setAudioPermission("granted");
      setIsTestingMic(true);

      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i += 1) {
          const normalized = (data[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const level = Math.sqrt(sumSquares / data.length);
        maxLevelRef.current = Math.max(maxLevelRef.current, level);
        setAudioLevel(level);
        if (level > 0.02) {
          setAudioDetected(true);
        }
        animationRef.current = window.requestAnimationFrame(loop);
      };
      animationRef.current = window.requestAnimationFrame(loop);
    } catch {
      setAudioPermission("denied");
      stopMicTest(false);
    }
  };

  const stopMicTest = async (shouldValidate = true) => {
    if (animationRef.current) {
      window.cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (contextRef.current) {
      await contextRef.current.close();
      contextRef.current = null;
    }
    setIsTestingMic(false);
    if (!shouldValidate) return;
    const enoughDuration = Date.now() - testStartedAtRef.current >= 2000;
    const passed = enoughDuration && maxLevelRef.current > 0.02;
    setMicTestChecked(passed);
  };

  return (
    <form className="card setup-form" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Realtime AI Interview</p>
        <h1>맞춤 면접을 시작하세요</h1>
        <p className="subtext">
          이력서/자소서 기반 질문과 꼬리 질문이 실시간으로 이어집니다. 음성 답변 제한은
          질문당 90초입니다.
        </p>
      </div>

      <section className="panel">
        <h3>문서 업로드</h3>
        <p className="subtext compact">
          업로드한 문서는 브라우저에 저장되고, 면접 시작 시 문서 이름으로 선택할 수 있습니다.
        </p>
        <div className="field-row">
          <label className="field">
            <span>문서 유형</span>
            <select value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
              <option value="RESUME">이력서</option>
              <option value="COVER_LETTER">자소서</option>
            </select>
          </label>
          <label className="field">
            <span>표시 이름 (선택)</span>
            <input
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              placeholder="예: 백엔드 지원 자소서"
            />
          </label>
        </div>
        <div className="upload-row">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
          />
          <button className="ghost-btn" type="button" onClick={uploadDocument} disabled={!uploadFile}>
            문서 추가
          </button>
        </div>
        <div className="doc-list">
          {documents.length === 0 && <p className="subtext compact">등록된 문서가 없습니다.</p>}
          {documents.map((doc) => (
            <article key={doc.id} className="doc-item">
              <div>
                <strong>{doc.name}</strong>
                <p className="subtext compact">
                  {doc.type === "RESUME" ? "이력서" : "자소서"} · {doc.fileName} · {formatSize(doc.size)}
                </p>
              </div>
              <button className="ghost-btn" type="button" onClick={() => removeDocument(doc.id)}>
                삭제
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h3>면접 설정</h3>
        <div className="field-row">
          <label className="field">
            <span>이력서 선택</span>
            <select
              value={selectedResumeId}
              onChange={(event) => setSelectedResumeId(event.target.value)}
            >
              <option value="">선택 안 함</option>
              {resumeDocs.map((doc) => (
                <option value={doc.id} key={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>자소서 선택</span>
            <select
              value={selectedCoverLetterId}
              onChange={(event) => setSelectedCoverLetterId(event.target.value)}
            >
              <option value="">선택 안 함</option>
              {coverLetterDocs.map((doc) => (
                <option value={doc.id} key={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="subtext compact">
          문서는 선택 사항입니다. 선택하지 않으면 공통 질문 기반으로 면접이 시작됩니다.
        </p>
      </section>

      <div className="field-row">
        <label className="field">
          <span>지원 직무</span>
          <select value={jobField} onChange={(event) => setJobField(event.target.value)}>
            {JOB_FIELDS.map((field) => (
              <option value={field} key={field}>
                {field}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>면접 시간(분)</span>
          <input
            type="number"
            min={5}
            max={120}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            required
          />
        </label>
      </div>

      <section className="panel">
        <h3>마이크 및 오디오 테스트</h3>
        <p className="subtext compact">
          브라우저 권한 허용 후 2초 이상 음성이 감지되면 체크박스를 선택할 수 있습니다.
        </p>
        <div className="audio-test-row">
          <button className="ghost-btn" type="button" onClick={startMicTest} disabled={isTestingMic}>
            {isTestingMic ? "테스트 진행 중..." : "마이크 테스트 시작"}
          </button>
          <button className="ghost-btn" type="button" onClick={() => stopMicTest(true)} disabled={!isTestingMic}>
            테스트 종료
          </button>
        </div>
        <div className="audio-meter">
          <div className="audio-meter-fill" style={{ width: `${Math.min(100, audioLevel * 900)}%` }} />
        </div>
        <p className="subtext compact">
          상태:{" "}
          {audioPermission === "idle" && "테스트 전"}
          {audioPermission === "requesting" && "마이크 권한 요청 중"}
          {audioPermission === "granted" && "권한 허용됨"}
          {audioPermission === "denied" && "권한 거부 또는 장치 오류"}
          {" / "}음성 감지: {audioDetected ? "성공" : "대기"}
        </p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={micTestChecked}
            disabled={!micTestChecked}
            onChange={(event) => setMicTestChecked(event.target.checked)}
          />
          <span>마이크/오디오 테스트를 완료했습니다.</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={agreeRule}
            onChange={(event) => setAgreeRule(event.target.checked)}
          />
          <span>질문당 최대 1분 30초 답변 제한 규칙을 확인했습니다.</span>
        </label>
      </section>

      <button className="primary-btn" type="submit" disabled={!canStartInterview}>
        {isSubmitting ? "세션 생성 중..." : "면접 시작"}
      </button>
    </form>
  );
}
