import { fetchWithAuth } from "./apiClient";

const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:8080";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || `${BACKEND_BASE_URL}/v1/interviews`;
const USE_MOCK_ALL = String(import.meta.env.VITE_USE_MOCK).toLowerCase() === "true";
const USE_MOCK_SESSION =
  USE_MOCK_ALL ||
  String(import.meta.env.VITE_USE_MOCK_INTERVIEW_SESSION).toLowerCase() === "true";
const USE_MOCK_RESULT =
  USE_MOCK_ALL ||
  String(import.meta.env.VITE_USE_MOCK_INTERVIEW_RESULT).toLowerCase() === "true";

const mockStore = {
  sessions: new Map(),
  results: new Map(),
};

function request(path, options = {}) {
  return fetchWithAuth(`${API_BASE_URL}${path}`, options);
}

export function createInterviewSession(data) {
  if (USE_MOCK_SESSION) {
    return createMockSession(data);
  }
  return request("/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
//세션 종료 api
export function endInterviewSession(sessionId, reason) {
  if (USE_MOCK_SESSION) {
    return endMockSession(sessionId, reason);
  }
  return request(`/sessions/${sessionId}/end`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/**
 * 평가 서비스 직접 실행 API (추가)
 * 백엔드의 '직접 호출' 로직: /{sessionId}/evaluate
 */
export function triggerEvaluation(sessionId) {
  // 백엔드 설계대로 /{sessionId}/evaluate 호출
  return request(`/${sessionId}/evaluate`, {
    method: "POST"
  });
}

// //피드백 결과 조회 (삭제)
// export function getInterviewResult(sessionId) {
//   if (USE_MOCK_RESULT) {
//     return getMockResult(sessionId);
//   }
//   //수정. 수정전 : `/sessions/${sessionId}/result`
//   return request(`/feedback/${sessionId}`, {
//     method: "GET",
//     allowStatuses: [202],
//   }).then((payload) => {
//     const isEvaluating =
//       payload?.__httpStatus === 202 ||
//       payload?.code === "EVALUATING" ||
//       payload?.data?.status === "EVALUATING";
//     if (isEvaluating) {
//       return {
//         success: true,
//         pending: true,
//         message: payload?.message || payload?.data?.message || "면접 평가가 진행 중입니다.",
//       };
//     }
//     return payload;
//   });
// }


//피드백 결과 조회 (실제 백엔드 연동)
export function getInterviewResult(sessionId) {
  if (USE_MOCK_RESULT) {
    return getMockResult(sessionId);
  }

  return request(`/feedback/${sessionId}`, {
    method: "GET",
  }).then((payload) => {
    // 아직 평가 중인 경우 (백엔드가 success: false를 반환)
    if (payload.success === false) {
      return {
        success: true,
        pending: true,
        message: payload.totalFeedback || "AI 피드백이 생성 중입니다...",
      };
    }

    // 평가 완료 시
    return {
      success: true,
      pending: false,
      data: payload,
    };
  });
}

// //실제 피드백 결과 조회
// export function getInterviewResult(sessionId) {
//   if (USE_MOCK_RESULT) {
//     return getMockResult(sessionId);
//   }
//
//   return request(`/feedback/${sessionId}`, {
//     method: "GET",
//     allowStatuses: [202],
//   }).then((payload) => {
//     // 1. 아직 평가 중인 경우 (백엔드가 success: false를 주거나 HTTP 202인 경우)
//     if (payload.success === false || payload.__httpStatus === 202) {
//       return {
//         success: true,
//         pending: true, // true면 계속 EvaluatingView(로딩화면)가 떠있습니다.
//         message: payload.totalFeedback || "AI 피드백이 생성 중입니다...",
//       };
//     }
//
//     // 2. 평가 완료 시 (데이터가 정상적으로 왔을 때)
//     return {
//       success: true,
//       pending: false, // ★ false가 되어야 로딩 화면이 닫히고 결과 화면이 뜹니다.
//       data: payload   // 백엔드 FeedbackResponse(qaPairs, totalFeedback 등) 전체
//     };
//   });
//}

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
  const result = {
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
        userAnswer: "원자성과 일관성을 우선으로 보고, 경합 구간은 락 전략을 선택합니다.",
        bestAnswer: "격리 수준 선택 기준과 실제 장애 대응 경험까지 연결하면 더 좋습니다.",
      },
    ],
  };
  mockStore.sessions.set(sessionId, {
    status: "IN_PROGRESS",
    request: data,
    reason: null,
  });
  mockStore.results.set(sessionId, {
    resultChecks: 0,
    result,
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
  const session = mockStore.sessions.get(sessionId) || { status: "IN_PROGRESS", reason: null };
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
  const current =
    mockStore.results.get(sessionId) ||
    {
      resultChecks: 0,
      result: {
        overallFeedback:
          "답변 흐름은 안정적이지만, 근거 데이터와 수치를 포함하면 설득력이 더 높아집니다.",
        score: 82,
        qaList: [
          {
            turn: 1,
            question: "프로젝트에서 가장 자신 있는 기술 영역은 무엇인가요?",
            userAnswer: "백엔드 API 설계와 트랜잭션 처리입니다.",
            bestAnswer: "기술 선택 이유와 운영 중 개선 사례를 함께 제시하면 좋습니다.",
          },
        ],
      },
    };
  const session = mockStore.sessions.get(sessionId);
  if (session && session.status !== "EVALUATING") {
    throw new Error("아직 평가를 시작하지 않았습니다.");
  }
  current.resultChecks += 1;
  mockStore.results.set(sessionId, current);
  if (current.resultChecks < 2) {
    return {
      success: true,
      pending: true,
      message: "평가 진행 중입니다.",
    };
  }
  return {
    success: true,
    data: current.result,
  };
}

export function isMockMode() {
  return USE_MOCK_SESSION || USE_MOCK_RESULT;
}

export function __resetMockStoreForTests() {
  mockStore.sessions.clear();
  mockStore.results.clear();
}
