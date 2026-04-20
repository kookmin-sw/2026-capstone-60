const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://api.yourdomain.com/v1/interviews";
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK).toLowerCase() === "true";

const mockStore = {
  sessions: new Map(),
};

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
    const message = payload?.message || "요청 처리 중 오류가 발생했습니다.";
    throw new Error(message);
  }

  return payload;
}

export function createInterviewSession(data) {
  if (USE_MOCK) {
    return createMockSession(data);
  }
  return request("/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function endInterviewSession(sessionId, reason) {
  if (USE_MOCK) {
    return endMockSession(sessionId, reason);
  }
  return request(`/sessions/${sessionId}/end`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function getInterviewResult(sessionId) {
  if (USE_MOCK) {
    return getMockResult(sessionId);
  }
  return request(`/sessions/${sessionId}/result`, {
    method: "GET",
  });
}

function makeId(prefix) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createMockSession(data) {
  await delay(500);
  const sessionId = makeId("sess");
  const roomName = makeId("room");
  mockStore.sessions.set(sessionId, {
    status: "IN_PROGRESS",
    request: data,
    reason: null,
    resultChecks: 0,
    result: {
      overallFeedback:
        "기술 지식은 안정적이며 설명 구조가 좋았습니다. 성능 최적화 사례를 수치와 함께 보강하면 더 강한 답변이 됩니다.",
      score: 86,
      qaList: [
        {
          turn: 1,
          question: "최근 프로젝트에서 맡았던 역할을 설명해주세요.",
          userAnswer:
            "Spring Boot API 서버를 맡았고, 인증/인가와 데이터 모델링을 담당했습니다.",
          bestAnswer:
            "역할 + 의사결정 근거 + 개선 지표를 함께 제시하면 설득력이 올라갑니다.",
        },
        {
          turn: 2,
          question: "트랜잭션 처리에서 중요하게 보는 포인트는 무엇인가요?",
          userAnswer:
            "원자성과 일관성을 우선으로 보고, 경합 구간은 락 전략을 선택합니다.",
          bestAnswer:
            "격리 수준 선택 기준과 실제 장애 대응 경험까지 연결하면 더 좋습니다.",
        },
      ],
    },
  });

  return {
    success: true,
    data: {
      sessionId,
      livekit: {
        roomName,
        url: "wss://mock.livekit.local",
        accessToken: "mock-livekit-token",
        isMock: true,
      },
    },
  };
}

async function endMockSession(sessionId, reason) {
  await delay(400);
  const session = mockStore.sessions.get(sessionId);
  if (!session) {
    throw new Error("세션을 찾을 수 없습니다.");
  }
  session.status = "EVALUATING";
  session.reason = reason;
  mockStore.sessions.set(sessionId, session);
  return {
    success: true,
    message: "면접이 종료되었습니다. AI 피드백을 생성 중입니다.",
    data: { status: "EVALUATING" },
  };
}

async function getMockResult(sessionId) {
  await delay(250);
  const session = mockStore.sessions.get(sessionId);
  if (!session) {
    throw new Error("세션을 찾을 수 없습니다.");
  }
  if (session.status !== "EVALUATING") {
    throw new Error("아직 평가를 시작하지 않았습니다.");
  }

  session.resultChecks += 1;
  mockStore.sessions.set(sessionId, session);

  if (session.resultChecks < 2) {
    throw new Error("평가 진행 중입니다.");
  }

  session.status = "DONE";
  mockStore.sessions.set(sessionId, session);
  return {
    success: true,
    data: session.result,
  };
}

export function isMockMode() {
  return USE_MOCK;
}

export function __resetMockStoreForTests() {
  mockStore.sessions.clear();
}
