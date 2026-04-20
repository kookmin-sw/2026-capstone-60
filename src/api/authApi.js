import {
  clearAuthSession,
  getAccessToken,
  getStoredUser,
  setAuthSession,
} from "../auth/tokenStorage";

const AUTH_BASE_URL =
  import.meta.env.VITE_AUTH_BASE_URL || "https://api.yourdomain.com/v1/auth";
const USE_MOCK = String(import.meta.env.VITE_USE_MOCK).toLowerCase() === "true";

const mockUsers = [
  {
    id: 1,
    email: "demo@interview.ai",
    name: "Demo User",
    password: "demo1234",
    role: "USER",
  },
];

async function request(path, options = {}) {
  const response = await fetch(`${AUTH_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
    const message = payload?.message || "인증 요청 처리에 실패했습니다.";
    throw new Error(message);
  }

  return payload;
}

export async function login(email, password) {
  if (USE_MOCK) {
    return mockLogin(email, password);
  }
  const payload = await request("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = payload?.data || payload;
  if (!data?.accessToken) {
    throw new Error("accessToken이 응답에 포함되어야 합니다.");
  }
  setAuthSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  });
  return data.user || null;
}

export async function fetchMe() {
  if (USE_MOCK) {
    const user = getStoredUser();
    const token = getAccessToken();
    if (!token || !user) throw new Error("로그인이 필요합니다.");
    return user;
  }
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");

  const payload = await request("/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = payload?.data || payload;
  if (!data) throw new Error("사용자 정보를 가져올 수 없습니다.");
  setAuthSession({ accessToken: token, user: data });
  return data;
}

export function logout() {
  clearAuthSession();
}

async function mockLogin(email, password) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const user = mockUsers.find((entry) => entry.email === email && entry.password === password);
  if (!user) {
    throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
  }
  const authUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  setAuthSession({
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    user: authUser,
  });
  return authUser;
}
