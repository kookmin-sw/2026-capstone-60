import { beforeEach, describe, expect, it } from "vitest";
import { fetchMe, login, logout } from "./authApi";

describe("authApi mock jwt flow", () => {
  beforeEach(() => {
    logout();
  });

  it("logs in and persists user session", async () => {
    const user = await login("demo", "demo1234");
    expect(user.loginId).toBe("demo");
    expect(localStorage.getItem("accessToken")).toBeTruthy();

    const profile = await fetchMe();
    expect(profile.loginId).toBe("demo");
  });

  it("rejects invalid credentials", async () => {
    await expect(login("wrong", "bad")).rejects.toThrow(
      "아이디 또는 비밀번호가 올바르지 않습니다."
    );
  });
});
