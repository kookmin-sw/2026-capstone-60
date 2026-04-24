# AI Interview Backend Integration Spec (Single Document)

프론트엔드와 백엔드 연동에 필요한 인증/면접/기록 저장 규격을 하나의 문서로 통합했습니다.  
백엔드 구현 기준 문서로 사용하세요.

---

## 1) 공통 규약

### Base URL

- Auth: `https://api.yourdomain.com/v1/auth`
- Interview: `https://api.yourdomain.com/v1/interviews`

### Header

- `Content-Type: application/json`
- `Authorization: Bearer <accessToken>` (인증 필요 API)

### 공통 응답 래퍼(권장)

```json
{
  "success": true,
  "data": {}
}
```

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "message": "인증이 필요합니다."
}
```

---

## 2) 인증(Auth) API

### 2.1 로그인

- **POST** `/v1/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-access-token",
    "refreshToken": "refresh-token",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "홍길동",
      "role": "USER"
    }
  }
}
```

### 2.2 내 정보 조회

- **GET** `/v1/auth/me`
- 인증 필요

Response `200`:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "홍길동",
    "role": "USER"
  }
}
```

---

## 3) 면접 세션 API

### 3.1 면접 세션 생성

- **POST** `/v1/interviews/sessions`
- 인증 필요

Request:

```json
{
  "resumeIds": 1,
  "coverLetter": 3,
  "jobField": "BACKEND",
  "durationMinutes": 15
}
```

필드 참고:

- `resumeIds`: optional (`null` 허용)
- `coverLetter`: optional (`null` 허용)
- `jobField`: 필수
- `durationMinutes`: 필수

Response `200`:

```json
{
  "success": true,
  "data": {
    "sessionId": "sess-uuid-1234",
    "livekit": {
      "roomName": "room-uuid-1234",
      "url": "wss://your-livekit-url.cloud",
      "accessToken": "eyJhbGciOiJIUzI1NiIsIn..."
    }
  }
}
```

### 3.2 면접 종료

- **POST** `/v1/interviews/sessions/{sessionId}/end`
- 인증 필요

Request:

```json
{
  "reason": "USER_STOP"
}
```

`reason`:

- `USER_STOP`
- `TIME_OVER`

Response `200`:

```json
{
  "success": true,
  "message": "면접이 종료되었습니다. AI 피드백을 생성 중입니다.",
  "data": {
    "status": "EVALUATING"
  }
}
```

### 3.3 면접 결과 조회

- **GET** `/v1/interviews/sessions/{sessionId}/result`
- 인증 필요

Response `200` (평가 완료):

```json
{
  "success": true,
  "data": {
    "overallFeedback": "피드백 내용",
    "score": 85,
    "qaList": [
      {
        "turn": 1,
        "question": "질문",
        "userAnswer": "내 답변",
        "bestAnswer": "모범 답안"
      }
    ]
  }
}
```

Response `200` (평가 진행 중):

```json
{
  "success": true,
  "data": {
    "status": "EVALUATING",
    "message": "면접 평가가 진행 중입니다."
  }
}
```

---

## 4) 면접 결과 기록(누적 히스토리) API

프론트는 결과 생성 직후 기록을 저장하고, 메뉴에서 누적 기록 목록/상세를 조회합니다.

### 4.1 결과 기록 저장

- **POST** `/v1/interviews/results`
- 인증 필요

Request:

```json
{
  "sessionId": "sess-uuid-1234",
  "jobField": "BACKEND",
  "durationMinutes": 15,
  "result": {
    "overallFeedback": "피드백 내용",
    "score": 85,
    "qaList": [
      {
        "turn": 1,
        "question": "질문",
        "userAnswer": "내 답변",
        "bestAnswer": "모범 답안"
      }
    ]
  }
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "id": "hist-uuid-1",
    "sessionId": "sess-uuid-1234",
    "jobField": "BACKEND",
    "durationMinutes": 15,
    "createdAt": "2026-04-20T12:00:00Z",
    "result": {
      "overallFeedback": "피드백 내용",
      "score": 85,
      "qaList": []
    }
  }
}
```

### 4.2 내 면접 기록 목록

- **GET** `/v1/interviews/results`
- 인증 필요

Response `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": "hist-uuid-1",
      "sessionId": "sess-uuid-1234",
      "score": 85,
      "overallFeedback": "요약 피드백",
      "jobField": "BACKEND",
      "durationMinutes": 15,
      "createdAt": "2026-04-20T12:00:00Z"
    }
  ]
}
```

### 4.3 내 면접 기록 상세

- **GET** `/v1/interviews/results/{recordId}`
- 인증 필요

Response `200`:

```json
{
  "success": true,
  "data": {
    "id": "hist-uuid-1",
    "sessionId": "sess-uuid-1234",
    "jobField": "BACKEND",
    "durationMinutes": 15,
    "createdAt": "2026-04-20T12:00:00Z",
    "result": {
      "overallFeedback": "상세 피드백",
      "score": 85,
      "qaList": [
        {
          "turn": 1,
          "question": "질문",
          "userAnswer": "내 답변",
          "bestAnswer": "모범 답안"
        }
      ]
    }
  }
}
```

---

## 5) 보안 및 권한(백엔드 필수)

- 모든 인터뷰/기록 API에 JWT 인증 필터 적용
- 기록 목록/상세는 **로그인 사용자 본인 데이터만** 반환
- 타인 기록 조회 시 `403` 또는 `404` 반환
- CORS에서 프론트 도메인 + `Authorization` 헤더 허용
- 운영 환경 HTTPS 강제

---

## 6) 백엔드 구현 체크리스트

- [ ] `POST /v1/auth/login` 구현
- [ ] `GET /v1/auth/me` 구현
- [ ] JWT 인증 미들웨어 적용
- [ ] `POST /v1/interviews/sessions` 구현 (`resumeIds`, `coverLetter` optional 처리)
- [ ] `POST /v1/interviews/sessions/{sessionId}/end` 구현
- [ ] `GET /v1/interviews/sessions/{sessionId}/result` 구현 (`200 + data.status=EVALUATING` 권장)
- [ ] `POST /v1/interviews/results` 구현
- [ ] `GET /v1/interviews/results` 구현 (본인 기록만)
- [ ] `GET /v1/interviews/results/{recordId}` 구현 (본인 기록만)
- [ ] 에러 응답 포맷 통일 (`success`, `code`, `message`)

---

## 7) 프론트 동작 기준 요약

- 로그인 성공 시 JWT를 저장하고 이후 API에 Bearer 토큰 자동 첨부
- 면접 종료 후 결과 수신 시 기록 저장 API 호출
- 기록 메뉴에서 목록/상세 조회
- 기록 저장 실패는 결과 화면 표시를 막지 않음 (비차단 처리)
- 결과 조회 API는 `success=true` 형태를 유지하며, 평가 진행 중에는 `data.status=EVALUATING`로 응답

