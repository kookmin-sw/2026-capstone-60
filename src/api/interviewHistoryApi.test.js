import { beforeEach, describe, expect, it } from "vitest";
import { login, logout } from "./authApi";
import {
  fetchInterviewRecordDetail,
  fetchInterviewRecords,
  saveInterviewRecord,
} from "./interviewHistoryApi";

describe("interview history api mock flow", () => {
  beforeEach(async () => {
    logout();
    localStorage.removeItem("interviewHistoryRecords");
    await login("demo@interview.ai", "demo1234");
  });

  it("saves and fetches my interview history", async () => {
    const saved = await saveInterviewRecord({
      sessionId: "sess-test-1",
      jobField: "BACKEND",
      durationMinutes: 15,
      result: {
        overallFeedback: "테스트 피드백",
        score: 90,
        qaList: [{ turn: 1, question: "Q", userAnswer: "A", bestAnswer: "B" }],
      },
    });
    expect(saved.success).toBe(true);

    const list = await fetchInterviewRecords();
    expect(list.data.length).toBe(1);

    const detail = await fetchInterviewRecordDetail(list.data[0].id);
    expect(detail.data.sessionId).toBe("sess-test-1");
    expect(detail.data.result.score).toBe(90);
  });
});
