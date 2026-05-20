import { fetchWithAuth } from "./apiClient";

const BACKEND_BASE_URL =
    import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:8080";
const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || `${BACKEND_BASE_URL}/v1/interviews`;
const USE_MOCK_ALL = String(import.meta.env.VITE_USE_MOCK).toLowerCase() === "true";
const USE_MOCK_HISTORY =
    USE_MOCK_ALL ||
    String(import.meta.env.VITE_USE_MOCK_INTERVIEW_HISTORY).toLowerCase() === "true";
const HISTORY_KEY = "interviewHistoryRecords";

function request(path, options = {}) {
  return fetchWithAuth(`${API_BASE_URL}${path}`, options);
}

//면접 피드백 저장 (백엔드에서 평가 완료 시 자동 저장되므로 별도 호출 불필요)
export async function saveInterviewRecord(recordInput) {
  if (USE_MOCK_HISTORY) {
    return saveMockInterviewRecord(recordInput);
  }
  // 실제 백엔드에서는 endSession → evaluate 흐름에서 자동 저장됨
  return { success: true };
}

/** feedbackList 응답을 목록 UI 형식으로 정규화 */
export function normalizeFeedbackListItem(item) {
  if (!item) return null;
  return {
    sessionId: item.sessionId ?? item.id,
    category: item.category ?? item.jobField ?? "직무 미지정",
    overallScore: item.overallScore ?? item.score ?? null,
    totalFeedback: item.totalFeedback ?? "",
    createdAt: item.createdAt ?? item.interviewDate ?? null,
    success: item.success,
  };
}

//피드백 목록 조회
export async function fetchInterviewRecords() {
  if (USE_MOCK_HISTORY) {
    return fetchMockInterviewRecords();
  }
  const payload = await request("/feedbackList", { method: "GET" });
  const raw = Array.isArray(payload) ? payload : payload?.data ?? [];
  return raw.map(normalizeFeedbackListItem).filter(Boolean);
}

//피드백 상세 조회
export async function fetchInterviewRecordDetail(recordId) {
  if (USE_MOCK_HISTORY) {
    return fetchMockInterviewRecordDetail(recordId);
  }
  return request(`/feedback/${recordId}`, { method: "GET" });
}

// ─── Mock 구현 ───────────────────────────────────────────────────────

function getMockRecords() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setMockRecords(records) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
}

async function saveMockInterviewRecord(recordInput) {
  const records = getMockRecords();
  const next = {
    id: `hist-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...recordInput,
  };
  setMockRecords([next, ...records]);
  return { success: true, data: next };
}

async function fetchMockInterviewRecords() {
  const records = getMockRecords().map((record) => ({
        id: record.id,
        sessionId: record.sessionId,
        overallScore: record.result?.overallScore ?? null,
        totalFeedback: record.result?.totalFeedback ?? "",
        jobField: record.jobField,
        durationMinutes: record.durationMinutes,
        createdAt: record.createdAt,
      }));
  return { success: true, data: records };
}

async function fetchMockInterviewRecordDetail(recordId) {
  const records = getMockRecords();
  const record = records.find((item) => item.id === recordId);
  if (!record) {
    throw new Error("면접 기록을 찾을 수 없습니다.");
  }
  return { success: true, data: record };
}

/**
 * 면접 기록을 삭제한다.
 *
 * @param {string} sessionId - 삭제할 면접 세션 ID
 */
export async function deleteInterviewRecord(sessionId) {
  if (USE_MOCK_HISTORY) {
    const records = getMockRecords().filter((r) => r.sessionId !== sessionId);
    setMockRecords(records);
    return { success: true };
  }
  return request(`/sessions/${sessionId}`, { method: "DELETE" });
}
