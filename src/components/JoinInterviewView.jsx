import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { joinSession } from "../api/interviewApi";
import { getMyResumes } from "../api/resumeApi";
import { Button } from "./ui/button";

function formatJoinError(err) {
  if (err?.status === 401) return "로그인이 필요합니다.";
  if (err?.status === 409) {
    return err.message || "이미 대기실에 참가 중이거나 정원이 찼습니다.";
  }
  if (err?.status === 400) {
    return err.message || "현재 세션 상태에서는 입장할 수 없습니다.";
  }
  return err?.message || "면접 입장에 실패했습니다.";
}

export default function JoinInterviewView({ user, onJoined, onError }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [localError, setLocalError] = useState("");
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyResumes();
        const list = Array.isArray(data) ? data : [];
        setResumes(list);
        if (list.length > 0) setSelectedResumeId(String(list[0].id));
      } catch {
        setResumes([]);
      } finally {
        setResumeLoading(false);
      }
    }
    load();
  }, []);

  const handleJoin = useCallback(async () => {
    if (!sessionId || !user) return;

    if (!selectedResumeId) {
      const message = "입장 전 본인 이력서를 선택해 주세요.";
      setLocalError(message);
      onError?.(message);
      return;
    }

    try {
      setLoading(true);
      setLocalError("");
      const response = await joinSession(sessionId, {
        resumeId: Number(selectedResumeId),
      });
      const data = response?.data ?? response;

      onJoined({
        sessionId: data.sessionId ?? sessionId,
        livekit: data.livekit,
        role: data.role || "GUEST",
        myIdentity: data.myIdentity,
        mode: data.mode || "GROUP",
        maxParticipants: data.maxParticipants,
        status: data.status,
        jobField: data.jobField,
        durationMinutes: data.durationMinutes,
      });

      if (data.status === "IN_PROGRESS") {
        navigate("/interview/room");
      } else {
        navigate("/interview/lobby");
      }
    } catch (err) {
      const message = formatJoinError(err);
      setLocalError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, user, selectedResumeId, onJoined, onError, navigate]);

  if (resumeLoading) {
    return (
      <section className="card wizard-card">
        <p className="subtext">이력서 목록을 불러오는 중...</p>
      </section>
    );
  }

  if (resumes.length === 0) {
    return (
      <section className="card wizard-card">
        <div className="step-desc">
          <h2>그룹 면접 입장</h2>
          <p className="subtext">
            입장하려면 마이페이지에서 본인 이력서를 먼저 등록해야 합니다.
          </p>
        </div>
        <Button className="primary-btn" onClick={() => navigate("/mypage")}>
          마이페이지로 이동
        </Button>
      </section>
    );
  }

  return (
    <section className="card wizard-card">
      <div className="step-desc">
        <h2>그룹 면접 입장</h2>
        <p className="subtext">
          초대 링크로 접속했습니다. <strong>본인 이력서</strong>를 선택한 뒤 입장하면 서버에
          join 요청이 전송됩니다.
        </p>
        <p className="subtext compact">
          세션 ID: <code>{sessionId}</code>
        </p>
      </div>

      {localError && <p className="form-error">{localError}</p>}

      <label className="field">
        <span>이력서 (필수)</span>
        <select
          value={selectedResumeId}
          onChange={(e) => setSelectedResumeId(e.target.value)}
          required
        >
          <option value="">선택해 주세요</option>
          {resumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>

      <Button
        className="primary-btn"
        style={{ width: "100%", marginTop: "1rem" }}
        onClick={handleJoin}
        disabled={loading || !user || !selectedResumeId}
      >
        {loading ? "입장 중..." : "대기실 입장"}
      </Button>
    </section>
  );
}
