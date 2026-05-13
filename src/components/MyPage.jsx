import { useState } from "react";
import ResumeManager from "./ResumeManager";

export default function MyPage({ user, onUpdate, onDelete, updating, deleting }) {
  const [name, setName] = useState(user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdate = async (event) => {
    event.preventDefault();
    setEditError("");
    setEditSuccess("");

    if (newPassword && newPassword !== newPasswordConfirm) {
      setEditError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPassword && !currentPassword) {
      setEditError("비밀번호를 변경하려면 현재 비밀번호를 입력해 주세요.");
      return;
    }

    const payload = {};
    if (name.trim() && name.trim() !== user?.name) payload.name = name.trim();
    if (currentPassword) payload.currentPassword = currentPassword;
    if (newPassword) payload.newPassword = newPassword;

    if (Object.keys(payload).length === 0) {
      setEditError("변경할 내용이 없습니다.");
      return;
    }

    try {
      await onUpdate(payload);
      setEditSuccess("정보가 성공적으로 수정되었습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (err) {
      setEditError(err.message || "정보 수정에 실패했습니다.");
    }
  };

  const handleDelete = async (event) => {
    event.preventDefault();
    setDeleteError("");

    try {
      await onDelete(deletePassword);
    } catch (err) {
      setDeleteError(err.message || "회원 탈퇴에 실패했습니다.");
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="mypage-layout">
      {/* 내 정보 */}
      <section className="card mypage-card">
        <div className="mypage-section-header">
          <p className="eyebrow">Account</p>
          <h2>내 정보</h2>
        </div>
        <dl className="info-list">
          <div className="info-row">
            <dt>아이디</dt>
            <dd>{user?.loginId}</dd>
          </div>
          <div className="info-row">
            <dt>이름</dt>
            <dd>{user?.name}</dd>
          </div>
          <div className="info-row">
            <dt>가입일</dt>
            <dd>{formatDate(user?.createdAt)}</dd>
          </div>
        </dl>
      </section>

      {/* 이력서 관리 */}
      <ResumeManager />

      {/* 정보 수정 */}
      <section className="card mypage-card">
        <div className="mypage-section-header">
          <p className="eyebrow">Edit</p>
          <h2>정보 수정</h2>
        </div>

        <form className="setup-form" onSubmit={handleUpdate}>
          {editError && <p className="form-error">{editError}</p>}
          {editSuccess && <p className="form-success">{editSuccess}</p>}

          <label className="field">
            <span>이름 변경</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="새로운 이름"
              maxLength={50}
            />
          </label>

          <div className="mypage-divider" />

          <label className="field">
            <span>현재 비밀번호</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="비밀번호 변경 시 입력"
              autoComplete="current-password"
            />
          </label>

          <label className="field">
            <span>새 비밀번호</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호 (선택)"
              autoComplete="new-password"
            />
          </label>

          <label className="field">
            <span>새 비밀번호 확인</span>
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder="새 비밀번호 재입력"
              autoComplete="new-password"
            />
          </label>

          <button className="primary-btn" type="submit" disabled={updating}>
            {updating ? "저장 중..." : "변경 사항 저장"}
          </button>
        </form>
      </section>

      {/* 회원 탈퇴 */}
      <section className="card mypage-card mypage-danger-zone">
        <div className="mypage-section-header">
          <p className="eyebrow" style={{ color: "var(--red-700)" }}>Danger Zone</p>
          <h2>회원 탈퇴</h2>
        </div>
        <p className="subtext">
          탈퇴 시 계정 정보와 면접 기록이 모두 삭제되며 복구할 수 없습니다.
        </p>

        {!showDeleteConfirm ? (
          <button
            className="ghost-btn danger-outline-btn"
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
          >
            회원 탈퇴하기
          </button>
        ) : (
          <form className="setup-form" onSubmit={handleDelete}>
            {deleteError && <p className="form-error">{deleteError}</p>}
            <label className="field">
              <span>비밀번호 확인</span>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="현재 비밀번호를 입력하세요"
                autoComplete="current-password"
                required
              />
            </label>
            <div className="inline-actions">
              <button className="danger-btn" type="submit" disabled={deleting}>
                {deleting ? "처리 중..." : "탈퇴 확인"}
              </button>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword("");
                  setDeleteError("");
                }}
              >
                취소
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
