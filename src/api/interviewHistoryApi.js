import { getStoredUser } from "../auth/tokenStorage";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://api.yourdomain.com/v1/interviews";
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK).toLowerCase() === "true";
const HISTORY_KEY = "interviewHistoryRecords";

function buildHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };
  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    import.meta.env.VITE_AUTH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...buildHeaders(),
      ...(options.headers || {}),
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || "면접 기록 요청 처리에 실패했습니다.";
    throw new Error(message);
  }

  return payload;
}

export async function saveInterviewRecord(recordInput) {
  if (USE_MOCK) {
    return saveMockInterviewRecord(recordInput);
  }
  return request("/results", {
    method: "POST",
    body: JSON.stringify(recordInput),
  });
}

export async function fetchInterviewRecords() {
  if (USE_MOCK) {
    return fetchMockInterviewRecords();
  }
  return request("/results", { method: "GET" });
}

export async function fetchInterviewRecordDetail(recordId) {
  if (USE_MOCK) {
    return fetchMockInterviewRecordDetail(recordId);
  }
  return request(`/results/${recordId}`, { method: "GET" });
}

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
  const user = getStoredUser();
  if (!user?.id) {
    throw new Error("로그인이 필요합니다.");
  }
  const records = getMockRecords();
  const next = {
    id: `hist-${Date.now()}`,
    userId: user.id,
    createdAt: new Date().toISOString(),
    ...recordInput,
  };
  setMockRecords([next, ...records]);
  return { success: true, data: next };
}

async function fetchMockInterviewRecords() {
  const user = getStoredUser();
  if (!user?.id) {
    throw new Error("로그인이 필요합니다.");
  }
  const records = getMockRecords()
    .filter((record) => record.userId === user.id)
    .map((record) => ({
      id: record.id,
      sessionId: record.sessionId,
      score: record.result?.score ?? null,
      overallFeedback: record.result?.overallFeedback ?? "",
      jobField: record.jobField,
      durationMinutes: record.durationMinutes,
      createdAt: record.createdAt,
    }));
  return { success: true, data: records };
}

async function fetchMockInterviewRecordDetail(recordId) {
  const user = getStoredUser();
  if (!user?.id) {
    throw new Error("로그인이 필요합니다.");
  }
  const record = getMockRecords().find(
    (item) => item.id === recordId && item.userId === user.id
  );
  if (!record) {
    throw new Error("면접 기록을 찾을 수 없습니다.");
  }
  return { success: true, data: record };
}
