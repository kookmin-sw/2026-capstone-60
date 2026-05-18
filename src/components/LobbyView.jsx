import { useCallback, useEffect, useState } from "react";
import { getLobby, setReady } from "../api/interviewApi";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export default function LobbyView({ session, onEnterRoom, onError }) {
  const [lobby, setLobby] = useState(null);
  const [loading, setLoading] = useState(true);
  const [readyLoading, setReadyLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const refreshLobby = useCallback(async () => {
    if (!session?.sessionId) return;
    try {
      const response = await getLobby(session.sessionId);
      const data = response?.data ?? response;
      setLobby(data);
      if (data.status === "IN_PROGRESS") {
        onEnterRoom({
          ...session,
          livekit: data.livekit,
          role: data.myRole,
          myIdentity: data.myIdentity,
          mode: data.mode,
          status: data.status,
        });
      }
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, onEnterRoom, onError]);

  useEffect(() => {
    refreshLobby();
    const id = window.setInterval(refreshLobby, 2500);
    return () => window.clearInterval(id);
  }, [refreshLobby]);

  const handleReady = async () => {
    try {
      setReadyLoading(true);
      const response = await setReady(session.sessionId);
      const data = response?.data ?? response;
      setLobby(data);
      if (data.status === "IN_PROGRESS") {
        onEnterRoom({
          ...session,
          livekit: data.livekit,
          role: data.myRole,
          myIdentity: data.myIdentity,
          mode: data.mode,
          status: data.status,
        });
      }
    } catch (err) {
      onError?.(err.message);
    } finally {
      setReadyLoading(false);
    }
  };

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/interview/join/${session.sessionId}`
      : `/interview/join/${session.sessionId}`;

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onError?.("클립보드 복사에 실패했습니다.");
    }
  };

  if (loading && !lobby) {
    return (
      <section className="card wizard-card">
        <p className="subtext">대기실 정보를 불러오는 중...</p>
      </section>
    );
  }

  const participants = lobby?.participants ?? [];

  return (
    <section className="card wizard-card">
      <div className="step-desc">
        <h2>그룹 면접 대기실</h2>
        <p className="subtext">
          친구에게 아래 세션 ID를 공유하세요. 전원이 준비 완료하면 면접이 자동으로 시작됩니다.
        </p>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <label className="field">
          <span>초대 링크 (공유용)</span>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <code style={{ flex: 1, wordBreak: "break-all", fontSize: "0.85rem" }}>
              {inviteUrl}
            </code>
            <Button type="button" variant="secondary" size="sm" onClick={copyInviteLink}>
              {copied ? "복사됨" : "링크 복사"}
            </Button>
          </div>
        </label>
        <p className="subtext compact">
          게스트는 링크 접속 → 로그인 → join API 호출 후 이 대기실로 이동합니다.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <Badge variant="default">
          {lobby?.currentParticipants ?? 0} / {lobby?.maxParticipants ?? session.maxParticipants}명
        </Badge>
        <Badge variant={lobby?.allReady ? "success" : "warning"}>
          준비 {lobby?.readyCount ?? 0}명
        </Badge>
        <Badge variant="secondary">{lobby?.status ?? "WAITING"}</Badge>
      </div>

      <ul className="panel" style={{ listStyle: "none", padding: "1rem", margin: 0 }}>
        {participants.map((p) => (
          <li
            key={p.memberId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0.5rem 0",
              borderBottom: "1px solid var(--slate-200)",
            }}
          >
            <span>
              {p.name} <span className="subtext">({p.role})</span>
            </span>
            <Badge variant={p.ready ? "success" : "warning"}>
              {p.ready ? "준비 완료" : "대기 중"}
            </Badge>
          </li>
        ))}
      </ul>

      {!lobby?.myReady && (
        <Button
          className="primary-btn"
          style={{ width: "100%", marginTop: "1rem" }}
          onClick={handleReady}
          disabled={readyLoading}
        >
          {readyLoading ? "처리 중..." : "준비 완료"}
        </Button>
      )}

      {lobby?.myReady && lobby?.status === "WAITING" && (
        <p className="subtext" style={{ marginTop: "1rem", textAlign: "center" }}>
          다른 참가자를 기다리는 중...
        </p>
      )}
    </section>
  );
}
