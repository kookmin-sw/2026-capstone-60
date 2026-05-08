import {
  clearAuthSession,
  getAccessToken,
  getStoredUser,
  setAuthSession,
} from "../auth/tokenStorage";
import { fetchWithAuth, fetchWithoutAuth } from "./apiClient";

const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:8080";
const AUTH_BASE_URL =
  import.meta.env.VITE_AUTH_BASE_URL || `${BACKEND_BASE_URL}/v1/auth`;

const USE_MOCK_ALL =
  String(import.meta.env.VITE_USE_MOCK).toLowerCase() === "true";
const USE_MOCK_AUTH =
  USE_MOCK_ALL ||
  String(import.meta.env.VITE_USE_MOCK_AUTH).toLowerCase() === "true";

const mockUsers = [
  {
    id: 1,
    loginId: "demo",
    name: "데모 사용자",
    password: "demo1234",
  },
];

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

export async function signup(loginId, password, name) {
  if (USE_MOCK_AUTH) {
    return mockSignup(loginId, password, name);
  }
  const payload = await fetchWithoutAuth(`${AUTH_BASE_URL}/signup`, {
    method: "POST",
    body: JSON.stringify({ loginId, password, name }),
  });
  return payload?.data || payload;
}

export async function login(loginId, password) {
  if (USE_MOCK_AUTH) {
    return mockLogin(loginId, password);
  }
  const payload = await fetchWithoutAuth(`${AUTH_BASE_URL}/login`, {
    method: "POST",
    body: JSON.stringify({ loginId, password }),
  });
  const data = payload?.data || payload;
  if (!data?.accessToken) {
    throw new Error("accessToken이 응답에 포함되어야 합니다.");
  }
  setAuthSession({ accessToken: data.accessToken });
  // 토큰 저장 후 내 정보 조회
  const user = await fetchMe();
  return user;
}

export async function fetchMe() {
  if (USE_MOCK_AUTH) {
    const user = getStoredUser();
    const token = getAccessToken();
    if (!token || !user) throw new Error("로그인이 필요합니다.");
    return user;
  }
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");

  const payload = await fetchWithAuth(`${AUTH_BASE_URL}/me`, {
    method: "GET",
  });
  const data = payload?.data || payload;
  if (!data) throw new Error("사용자 정보를 가져올 수 없습니다.");
  setAuthSession({ user: data });
  return data;
}

export async function updateMe({ name, currentPassword, newPassword }) {
  if (USE_MOCK_AUTH) {
    return mockUpdateMe({ name, currentPassword, newPassword });
  }
  const body = {};
  if (name !== undefined) body.name = name;
  if (currentPassword !== undefined) body.currentPassword = currentPassword;
  if (newPassword !== undefined) body.newPassword = newPassword;

  const payload = await fetchWithAuth(`${AUTH_BASE_URL}/me`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  const data = payload?.data || payload;
  if (data) setAuthSession({ user: data });
  return data;
}

export async function deleteMe(password) {
  if (USE_MOCK_AUTH) {
    return mockDeleteMe(password);
  }
  const payload = await fetchWithAuth(`${AUTH_BASE_URL}/me`, {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
  clearAuthSession();
  return payload;
}

export function logout() {
  clearAuthSession();
}

// ─────────────────────────────────────────────────────────
// Mock implementations
// ─────────────────────────────────────────────────────────

async function mockSignup(loginId, password, name) {
  await new Promise((r) => setTimeout(r, 300));
  if (mockUsers.some((u) => u.loginId === loginId)) {
    const err = new Error("이미 사용 중인 아이디입니다.");
    err.status = 409;
    err.code = "CONFLICT";
    throw err;
  }
  const newUser = { id: mockUsers.length + 1, loginId, name, password };
  mockUsers.push(newUser);
  return { id: newUser.id, loginId: newUser.loginId, name: newUser.name };
}

async function mockLogin(loginId, password) {
  await new Promise((r) => setTimeout(r, 300));
  const user = mockUsers.find(
    (u) => u.loginId === loginId && u.password === password
  );
  if (!user) {
    throw new Error("아이디 또는 비밀번호가 올바르지 않습니다.");
  }
  const authUser = {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    createdAt: new Date().toISOString(),
  };
  setAuthSession({ accessToken: "mock-access-token", user: authUser });
  return authUser;
}

async function mockUpdateMe({ name, currentPassword, newPassword }) {
  await new Promise((r) => setTimeout(r, 200));
  const stored = getStoredUser();
  if (!stored) throw new Error("로그인이 필요합니다.");

  if (newPassword && !currentPassword) {
    throw new Error("비밀번호 변경 시 현재 비밀번호가 필요합니다.");
  }
  if (currentPassword) {
    const user = mockUsers.find((u) => u.id === stored.id);
    if (!user || user.password !== currentPassword) {
      throw new Error("현재 비밀번호가 일치하지 않습니다.");
    }
    if (newPassword) user.password = newPassword;
  }

  const updated = { ...stored };
  if (name) updated.name = name;
  setAuthSession({ user: updated });
  return updated;
}

async function mockDeleteMe(password) {
  await new Promise((r) => setTimeout(r, 200));
  const stored = getStoredUser();
  if (!stored) throw new Error("로그인이 필요합니다.");

  const idx = mockUsers.findIndex(
    (u) => u.id === stored.id && u.password === password
  );
  if (idx === -1) throw new Error("비밀번호가 일치하지 않습니다.");
  mockUsers.splice(idx, 1);
  clearAuthSession();
  return { success: true, message: "회원 탈퇴가 완료되었습니다." };
}
