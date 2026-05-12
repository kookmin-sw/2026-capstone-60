import { getAccessToken } from "../auth/tokenStorage";

const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:8080";
const RESUME_API_URL = `${BACKEND_BASE_URL}/v1/resumes`;

/**
 * PDF 이력서를 백엔드에 업로드한다.
 * 백엔드에서 PDF → 텍스트 파싱 후 DB에 저장된다.
 *
 * @param {File} file - PDF 파일
 * @param {string} title - 이력서 제목
 * @returns {Promise<{id, title, originalText, fileUrl, keywords, createdAt}>}
 */
export async function uploadPdfResume(file, title) {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);

  const response = await fetch(`${RESUME_API_URL}/upload-pdf`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "이력서 업로드에 실패했습니다.");
  }

  return response.json();
}

/**
 * 텍스트 이력서를 백엔드에 저장한다.
 *
 * @param {string} title - 이력서 제목
 * @param {string} originalText - 이력서 텍스트
 * @returns {Promise<{id, title, originalText, fileUrl, keywords, createdAt}>}
 */
export async function uploadTextResume(title, originalText) {
  const token = getAccessToken();

  const response = await fetch(`${RESUME_API_URL}/upload-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ title, originalText }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "이력서 저장에 실패했습니다.");
  }

  return response.json();
}

/**
 * 내 이력서 목록을 조회한다.
 *
 * @returns {Promise<Array<{id, title, originalText, fileUrl, keywords, createdAt}>>}
 */
export async function getMyResumes() {
  const token = getAccessToken();

  const response = await fetch(RESUME_API_URL, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || "이력서 목록 조회에 실패했습니다.");
  }

  return response.json();
}
