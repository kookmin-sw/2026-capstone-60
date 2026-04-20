import { beforeEach, describe, expect, it } from "vitest";
import { fetchMe, login, logout } from "./authApi";

describe("authApi mock jwt flow", () => {
  beforeEach(() => {
    logout();
  });

  it("logs in and persists user session", async () => {
    const user = await login("demo@interview.ai", "demo1234");
    expect(user.email).toBe("demo@interview.ai");
    expect(localStorage.getItem("accessToken")).toBeTruthy();

    const profile = await fetchMe();
    expect(profile.email).toBe("demo@interview.ai");
  });

  it("rejects invalid credentials", async () => {
    await expect(login("wrong@interview.ai", "bad")).rejects.toThrow(
      "이메일 또는 비밀번호가 올바르지 않습니다."
    );
  });
});
