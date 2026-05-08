import { clearAuthSession, getAccessToken } from "../auth/tokenStorage";

export function dispatchUnauthorized() {
  window.dispatchEvent(new CustomEvent("auth:unauthorized"));
}

export async function fetchWithAuth(url, options = {}) {
  const token = getAccessToken();
  const { allowStatuses = [], ...fetchOptions } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers || {}),
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 401) {
    clearAuthSession();
    dispatchUnauthorized();
    const err = new Error(
      payload?.message || "인증이 만료되었습니다. 다시 로그인해 주세요."
    );
    err.status = 401;
    err.code = payload?.code;
    throw err;
  }

  const statusAllowed = allowStatuses.includes(response.status);
  if (!response.ok && !statusAllowed) {
    const err = new Error(payload?.message || "요청 처리 중 오류가 발생했습니다.");
    err.status = response.status;
    err.code = payload?.code;
    throw err;
  }

  if (payload && typeof payload === "object") {
    payload.__httpStatus = response.status;
  }
  return payload;
}

export async function fetchWithoutAuth(url, options = {}) {
  const response = await fetch(url, {
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
    const err = new Error(payload?.message || "요청 처리 중 오류가 발생했습니다.");
    err.status = response.status;
    err.code = payload?.code;
    throw err;
  }

  return payload;
}
