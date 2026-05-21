import { useEffect, useState } from "react";
import { getMyResumes, uploadPdfResume, deleteResume } from "../api/resumeApi";

/**
 * 마이페이지용 이력서 관리 컴포넌트.
 * 이력서 목록 조회, PDF 업로드, 삭제를 처리한다.
 */
export default function ResumeManager() {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [title, setTitle] = useState("");

  useEffect(() => {
    loadResumes();
  }, []);

  const loadResumes = async () => {
    try {
      setLoading(true);
      const data = await getMyResumes();
      setResumes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "이력서 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setError("");
    setSuccess("");

    const resumeTitle = title.trim() || uploadFile.name;

    try {
      await uploadPdfResume(uploadFile, resumeTitle);
      setSuccess("이력서가 등록되었습니다.");
      setUploadFile(null);
      setTitle("");
      await loadResumes();
    } catch (err) {
      setError(err.message || "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <section className="card mypage-card">
      <div className="mypage-section-header">
        <p className="eyebrow">Resume</p>
        <h2>이력서 관리</h2>
      </div>

      {/* 업로드 폼 */}
      <form className="setup-form" onSubmit={handleUpload}>
        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        <label className="field">
          <span>이력서 제목</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 백엔드 개발자 이력서"
            maxLength={100}
          />
        </label>

        <div className="upload-row">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
          />
          <button
            className="primary-btn"
            type="submit"
            disabled={!uploadFile || uploading}
          >
            {uploading ? "업로드 중..." : "이력서 등록"}
          </button>
        </div>
      </form>

      {/* 이력서 목록 */}
      {loading ? (
        <p className="subtext">불러오는 중...</p>
      ) : resumes.length === 0 ? (
        <p className="subtext">등록된 이력서가 없습니다.</p>
      ) : (
        <div className="doc-list">
          {resumes.map((resume) => (
            <article key={resume.id} className="doc-item">
              <div>
                <strong>{resume.title}</strong>
                <p className="subtext compact">
                  등록일: {formatDate(resume.createdAt)}
                  {resume.originalText && ` · ${resume.originalText.length}자`}
                </p>
              </div>
              <button
                className="ghost-btn"
                type="button"
                onClick={async () => {
                  if (!window.confirm(`"${resume.title}" 이력서를 삭제하시겠습니까?`)) return;
                  try {
                    await deleteResume(resume.id);
                    await loadResumes();
                  } catch (err) {
                    setError(err.message || "삭제에 실패했습니다.");
                  }
                }}
              >
                삭제
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
