import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetMockStoreForTests,
  createInterviewSession,
  endInterviewSession,
  getInterviewResult,
  isMockMode,
} from "./interviewApi";

describe("interviewApi mock mode flow", () => {
  beforeEach(() => {
    __resetMockStoreForTests();
  });

  it("uses mock mode in tests", () => {
    expect(isMockMode()).toBe(true);
  });

  it("completes session and returns result after polling retries", async () => {
    const created = await createInterviewSession({
      resumeIds: 1,
      coverLetter: 3,
      jobField: "BACKEND",
      durationMinutes: 15,
    });

    expect(created.success).toBe(true);
    expect(created.data.livekit.isMock).toBe(true);

    const { sessionId } = created.data;
    const ended = await endInterviewSession(sessionId, "USER_STOP");
    expect(ended.data.status).toBe("EVALUATING");

    await expect(getInterviewResult(sessionId)).rejects.toThrow("평가 진행 중입니다.");

    const result = await getInterviewResult(sessionId);
    expect(result.success).toBe(true);
    expect(result.data.score).toBeTypeOf("number");
    expect(result.data.qaList.length).toBeGreaterThan(0);
  });
});
