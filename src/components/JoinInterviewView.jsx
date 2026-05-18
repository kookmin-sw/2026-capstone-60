import { useCallback, useEffect, useRef, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [localError, setLocalError] = useState("");
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const joinStartedRef = useRef(false);

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

  const handleJoin = useCallback(async () => {
    if (!sessionId || !user) return;

    try {
      setLoading(true);
      setLocalError("");
      const body = selectedResumeId ? { resumeId: Number(selectedResumeId) } : {};
      const response = await joinSession(sessionId, body);
      const data = response?.data ?? response;

      onJoined({
        sessionId: data.sessionId ?? sessionId,
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
      const message = formatJoinError(err);
      setLocalError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, user, selectedResumeId, onJoined, onError, navigate]);

  useEffect(() => {
    if (!user || !sessionId || joinStartedRef.current) return;
    joinStartedRef.current = true;
    handleJoin();
  }, [user, sessionId, handleJoin]);

  return (
    <section className="card wizard-card">
      <div className="step-desc">
        <h2>그룹 면접 입장</h2>
        <p className="subtext">
          초대 링크로 접속했습니다. 로그인 후 서버에 입장 요청(POST join)을 보냅니다.
        </p>
        <p className="subtext compact">
          세션 ID: <code>{sessionId}</code>
        </p>
      </div>

      {localError && <p className="form-error">{localError}</p>}

      {resumes.length > 0 && !loading && (
        <label className="field">
          <span>이력서 (선택)</span>
          <select
            value={selectedResumeId}
            onChange={(e) => setSelectedResumeId(e.target.value)}
          >
            <option value="">선택 안 함</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {loading ? (
        <p className="subtext">대기실 입장 중...</p>
      ) : (
        <Button
          className="primary-btn"
          style={{ width: "100%", marginTop: "1rem" }}
          onClick={handleJoin}
          disabled={!user}
        >
          다시 입장 시도
        </Button>
      )}
    </section>
  );
}
