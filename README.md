# 🎙️ RAG 기반 AI 모의면접

> 실시간 음성 면접 · RAG 맞춤 질문 · AI 피드백 리포트를 제공하는 웹 애플리케이션

---

## 프로젝트 소개

취업 준비생이 실전과 동일한 환경에서 AI 면접관과 1:1 음성 면접을 연습할 수 있는 서비스입니다.  
이력서·자소서를 기반으로 직무에 꼭 맞는 질문을 실시간으로 생성하고, 면접 종료 후 LLM이 답변을 분석해 종합 피드백 리포트를 제공합니다.

---

## 주요 기능

### 🔐 JWT 인증
이메일/비밀번호 로그인 후 JWT 토큰을 발급받아 모든 API 요청에 자동으로 첨부합니다.  
앱 재접속 시 저장된 토큰으로 세션을 자동 복원합니다.

### 📝 4단계 위저드 세션 설정
면접 시작 전 단계별 가이드를 통해 설정을 완료합니다.

| 단계 | 내용 |
|:----:|------|
| **1** | 이력서 / 자소서 업로드 및 선택 |
| **2** | 지원 직무 · 면접 시간 설정 |
| **3** | 마이크 오디오 레벨 테스트 |
| **4** | 전체 설정 요약 확인 후 면접 시작 |

### 🎙️ 실시간 음성 면접
LiveKit WebRTC 기반 음성 연결로 실제 면접과 동일한 환경을 제공합니다.

- **전체 면접 타이머** — 설정된 시간 카운트다운
- **답변 타이머** — 질문당 최대 90초, 10초 전 경고 알림
- **마이크 제어** — ON/OFF 토글
- **실시간 이벤트 로그** — 면접 진행 상황 기록

### 📊 AI 피드백 리포트
면접 종료 후 LLM이 답변 전체를 분석해 리포트를 자동 생성합니다.

| 지표 | 설명 |
|------|------|
| 기술 정확성 | 기술 개념의 올바른 이해 및 설명 수준 |
| 논리성 | 답변의 구조와 근거 전개 방식 |
| 깊이 | 주제에 대한 심화 이해도 |
| 전달력 | 명확하고 간결한 의사전달 능력 |

종합 점수와 함께 질문별 **내 답변 vs 모범 답안** 비교를 제공합니다.

### 📁 누적 면접 기록
과거 면접 세션의 목록 및 상세 기록(점수, 피드백, 질문/답변)을 조회할 수 있습니다.

### 🥠 포츈쿠키
면접 전 긴장을 풀어주는 소소한 재미 요소입니다.  
쿠키를 클릭하면 20가지 응원 메시지 중 하나가 랜덤으로 등장합니다.

---

## 화면 흐름

```
홈 화면
  │
  ├── 로그인
  │
  └── 면접 시작
        │
        ▼
  세션 설정 위저드
  Step 1 · Step 2 · Step 3 · Step 4
        │
        ▼
  실시간 면접 진행
  (음성 연결 · 타이머 · 질문 표시)
        │
        ▼
  AI 평가 중...
        │
        ▼
  피드백 리포트
  (점수 · 지표 · 모범 답안)
        │
        ▼
  면접 기록 저장 → 기록 조회
```

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| UI 프레임워크 | React 18 |
| 라우팅 | React Router DOM v7 |
| 빌드 도구 | Vite 5 |
| 실시간 음성 | LiveKit Client (WebRTC) |
| 스타일 | 커스텀 CSS (CSS Variables 디자인 시스템) |
| 인증 | JWT (localStorage) |
| 테스트 | Vitest |

---

## 프로젝트 구조

```
src/
├── api/
│   ├── authApi.js               # 로그인, 내 정보 조회
│   ├── interviewApi.js          # 세션 생성 / 종료 / 결과 조회
│   └── interviewHistoryApi.js   # 기록 저장 / 목록 / 상세
├── auth/
│   └── tokenStorage.js          # JWT 토큰 관리
├── components/
│   ├── HomeView.jsx              # 홈 (히어로 · 피처 카드 · 포츈쿠키)
│   ├── LoginForm.jsx             # 로그인
│   ├── SessionSetupForm.jsx      # 4단계 위저드 세션 설정
│   ├── InterviewRoom.jsx         # 실시간 면접
│   ├── EvaluatingView.jsx        # AI 평가 대기
│   ├── ResultView.jsx            # 피드백 리포트
│   ├── HistoryListView.jsx       # 면접 기록 목록
│   ├── HistoryDetailView.jsx     # 면접 기록 상세
│   └── FortuneCookie.jsx         # 포츈쿠키
├── hooks/
│   └── useCountdown.js           # 카운트다운 타이머 훅
├── App.jsx                       # 라우팅 · 전역 상태
└── styles.css                    # 전역 디자인 시스템
```

---

## 그룹 면접 초대 링크

호스트가 `maxParticipants >= 2`로 세션을 만들면 대기실에서 아래 형식의 **초대 URL**을 복사해 공유합니다.

```
https://capstonefront.vercel.app/interview/join/{sessionId}
```

게스트 동작: 링크 접속 → (비로그인 시) 로그인/회원가입 → **`POST /v1/interviews/sessions/{sessionId}/join`** 호출 → 로비(`/interview/lobby`) 이동 → 준비 완료(`PATCH .../participants/me/ready`).

프로덕션 HTTPS에서는 `vercel.json`이 `/v1/*` 요청을 백엔드(`http://23.22.137.145:8080`)로 프록시해 Mixed Content를 피합니다. SPA 직접 URL 접근은 `index.html`로 fallback됩니다.

---

## 백엔드 연동 구조

```
[프론트엔드]                    [백엔드 서버]
     │                               │
     ├── POST /v1/auth/login ────────▶ JWT 발급
     ├── GET  /v1/auth/me ───────────▶ 세션 확인
     │                               │
     ├── POST /v1/interviews/sessions ▶ 면접 세션 생성
     │                                  └─▶ LiveKit 토큰 반환
     │                               │
     ├── POST /sessions/{id}/end ────▶ 면접 종료 → AI 평가 시작
     │                               │
     ├── GET  /sessions/{id}/result ─▶ 결과 폴링 (4초 간격)
     │          EVALUATING → 대기        └─▶ 완료 시 리포트 반환
     │                               │
     └── POST /v1/interviews/results ▶ 결과 기록 저장
         GET  /v1/interviews/results ─▶ 내 기록 목록
         GET  /v1/interviews/results/{id} ▶ 기록 상세
```

### 면접 세션 생성 요청

```json
POST /v1/interviews/sessions
{
  "resumeIds": 1,
  "coverLetter": 3,
  "jobField": "BACKEND",
  "durationMinutes": 15
}
```

지원 직무: `BACKEND` · `FRONTEND` · `ANDROID` · `IOS` · `DEVOPS` · `DATA` · `AI`

### 피드백 리포트 응답

```json
{
  "score": 85,
  "overallFeedback": "기술 이해도가 높고 논리적인 답변을 구성했습니다...",
  "qaList": [
    {
      "turn": 1,
      "question": "최근 프로젝트에서 어려웠던 기술 의사결정을 설명해주세요.",
      "userAnswer": "저는 ...",
      "bestAnswer": "이상적인 답변은 ..."
    }
  ]
}
```

---

## 시작하기

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일에서 백엔드 서버 주소 입력

# 개발 서버 실행
npm run dev
```

### 환경 변수

```bash
VITE_BACKEND_BASE_URL=http://localhost:8080
VITE_API_BASE_URL=http://localhost:8080/v1/interviews
VITE_AUTH_BASE_URL=http://localhost:8080/v1/auth
```

---

## 백엔드 연동 문서

API 명세 전문은 [`docs/backend-integration-spec.md`](./docs/backend-integration-spec.md)를 참고하세요.
