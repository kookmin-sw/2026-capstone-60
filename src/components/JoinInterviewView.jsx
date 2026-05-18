import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { joinSession } from "../api/interviewApi";
import { getMyResumes } from "../api/resumeApi";
import { Button } from "./ui/button";

export default function JoinInterviewView({ user, onJoined, onError }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyResumes();
        setResumes(Array.isArray(data) ? data : []);
      } catch {
        setResumes([]);
      }
    }
    load();
  }, []);

  const handleJoin = async () => {
    try {
      setLoading(true);
      const body = selectedResumeId ? { resumeId: Number(selectedResumeId) } : {};
      const response = await joinSession(sessionId, body);
      const data = response?.data ?? response;
      onJoined({
        sessionId: data.sessionId,
        livekit: data.livekit,
        role: data.role,
        myIdentity: data.myIdentity,
        mode: data.mode,
        maxParticipants: data.maxParticipants,
        status: data.status,
      });
      if (data.status === "IN_PROGRESS") {
        navigate("/interview/room");
      } else {
        navigate("/interview/lobby");
      }
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card wizard-card">
      <div className="step-desc">
        <h2>그룹 면접 입장</h2>
        <p className="subtext">세션 ID: <code>{sessionId}</code></p>
      </div>

      {resumes.length > 0 && (
        <label className="field">
          <span>이력서 (선택)</span>
          <select value={selectedResumeId} onChange={(e) => setSelectedResumeId(e.target.value)}>
            <option value="">선택 안 함</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>{r.title}</option>
            ))}
          </select>
        </label>
      )}

      <Button
        className="primary-btn"
        style={{ width: "100%", marginTop: "1rem" }}
        onClick={handleJoin}
        disabled={loading || !user}
      >
        {loading ? "입장 중..." : "대기실 입장"}
      </Button>
    </section>
  );
}
