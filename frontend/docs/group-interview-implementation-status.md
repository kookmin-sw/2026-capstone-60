# 다인 면접(GROUP) 구현 현황 및 LiveKit Agent 작업 가이드

> 작성 기준: 2026-05-18  
> 범위: `capstone_backend` + `capstone_front` (구현 완료) / LiveKit Agent (미구현)  
> 상세 API 계약: [INTEGRATION_CONTRACT.md](../INTEGRATION_CONTRACT.md) §11

---

## 1. 지향하는 시나리오 (목표 UX)

### 1.1 한 줄 요약

**면접 인원을 선택해 방을 만들고, 호스트가 `sessionId`를 공유하면 친구가 입장한다. 전원이 준비 완료되면 같은 LiveKit 방에서 AI 면접관이 참가자에게 번갈아 질문하고, 종료 후 각자 개별 피드백을 받는다.**

### 1.2 모드 구분

| 모드 | 조건 | 흐름 |
|------|------|------|
| **SOLO** | `maxParticipants = 1` (또는 생략) | 기존과 동일: 세션 생성 → 즉시 Agent dispatch → 면접실 |
| **GROUP** | `maxParticipants = 2~4` | 생성 → **대기실** → join → **Ready** → 전원 ready 시 **자동 시작** → 면접실 |

### 1.3 GROUP 상세 플로우

```
[호스트]
  로그인 → 면접 설정(인원 2~4명) → 세션 생성
  → 대기실: sessionId 복사·카톡 등으로 공유
  → "준비 완료" 클릭

[게스트]
  로그인 → /interview/join/{sessionId} (또는 링크)
  → (선택) 이력서 선택 → 대기실 입장
  → "준비 완료" 클릭

[서버]
  참가 인원 == maxParticipants && 전원 ready
  → Interview 상태 WAITING → IN_PROGRESS
  → Agent dispatch (metadata: GROUP + participants[])
  → LiveKit Room에 START Data 전송

[면접 중]
  같은 roomName, identity: user-{memberId}
  → Agent가 targetIdentity 지정하여 QUESTION 발행
  → 답변 차례인 사람만 마이크·답변 타이머 활성
  → 다른 참가자는 실시간 음성 청취(관전)
  → next/end는 호스트만 호출

[종료 후]
  호스트가 면접 종료 → evaluate 트리거
  → 참가자별 LLM 평가 (본인 QnA만)
  → 각자 GET /feedback/{sessionId} 로 본인 리포트만 조회
```

### 1.4 확정된 제품 정책

| 항목 | 정책 |
|------|------|
| 면접 시작 | 전원 Ready + 정원 충족 시 **서버 자동 start** (호스트 수동 시작 버튼 없음) |
| 턴 제어 | **호스트만** `next` / `end` (게스트는 관전·청취) |
| 평가 | **참가자마다 개별** 피드백 (본인 `respondentMemberId` QnA만) |
| 초대 | `sessionId` 복사·공유 (짧은 joinCode는 미구현) |
| LiveKit identity | `user-{memberId}` (참가자마다 별도 JWT) |

---

## 2. 변경된 사항 (구현 완료)

### 2.1 백엔드 (`capstone_backend`)

#### 도메인·DB

| 항목 | 파일/위치 |
|------|-----------|
| `InterviewStatus.WAITING` | `entity/InterviewStatus.java` |
| `InterviewMode` (SOLO / GROUP) | `entity/InterviewMode.java` |
| `Interview.maxParticipants`, `mode`, `currentSpeakerMemberId` | `entity/Interview.java` |
| `InterviewParticipant` (role, ready, 참가자별 feedback) | `entity/InterviewParticipant.java` |
| `InterviewQna.respondentMemberId` | `entity/InterviewQna.java` |
| 수동 마이그레이션 | `scripts/add-group-interview-support.sql` |

#### REST API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/v1/interviews/sessions` | body에 `maxParticipants` 추가 |
| POST | `/v1/interviews/sessions/{sessionId}/join` | body optional `{ "resumeId": number }` |
| GET | `/v1/interviews/sessions/{sessionId}/lobby` | 대기실 상태·참가자 목록 |
| PATCH | `/v1/interviews/sessions/{sessionId}/participants/me/ready` | 준비 → 조건 충족 시 auto start |
| POST | `/v1/interviews/sessions/{sessionId}/next` | GROUP: **HOST만** |
| POST | `/v1/interviews/sessions/{sessionId}/end` | GROUP: **HOST만** |
| POST | `/v1/interviews/{sessionId}/evaluate` | GROUP: `evaluateAllParticipants` |
| GET | `/v1/interviews/feedback/{sessionId}` | GROUP: **로그인 사용자 본인** 피드백만 |

#### 서비스·연동

- `InterviewService`: SOLO/GROUP 분기, `tryAutoStart`, join/lobby/ready
- `AgentDispatchService.dispatchGroup()`: GROUP metadata (`participants[]` 포함)
- `LiveKitRoomService.sendData`: auto start 시 `START` 메시지
- `InternalQnaRequest.respondentMemberId` + `InternalQnaService` 저장
- `EvaluationService.evaluateAllParticipants()`: 참가자별 Bedrock 평가
- `FeedbackService`: 그룹 시 participant 단위 조회·목록

### 2.2 프론트엔드 (`capstone_front`)

| 항목 | 파일 |
|------|------|
| 면접 인원 선택 (1~4명) | `components/SessionSetupForm.jsx` |
| 대기실 (sessionId 복사, ready, 폴링) | `components/LobbyView.jsx` |
| join 화면 | `components/JoinInterviewView.jsx` |
| 라우팅 `/interview/lobby`, `/interview/join/:sessionId` | `App.jsx` |
| API join / lobby / ready | `api/interviewApi.js` |
| HOST/GUEST, `targetIdentity`, 마이크·버튼 제어 | `components/InterviewRoom.jsx`, `InterviewRoomView.jsx` |

### 2.3 문서

- `INTEGRATION_CONTRACT.md` §11 — 그룹 면접 Backend/Frontend 스펙 및 Agent 체크리스트

---

## 3. 테스트 결과

### 3.1 자동 테스트 (실행 일자: 2026-05-18)

| 대상 | 명령 | 결과 |
|------|------|------|
| 백엔드 단위 | `./gradlew test --tests GroupInterviewFlowTest --tests EvaluationFlowTest` | **성공** |
| 프론트 | `npm test` (Vitest) | **23 tests passed** |

#### 백엔드 `GroupInterviewFlowTest` 검증 내용

- `maxParticipants=2` 생성 시 `WAITING`, Agent dispatch **미호출**
- 전원 ready 시 `IN_PROGRESS` 전환, `dispatchGroup` 호출, Room `START` Data 전송

#### 백엔드 `EvaluationFlowTest` 검증 내용

- SOLO 세션 평가·피드백 조회 (기존 회귀)

#### 프론트 테스트

- `authApi`, `interviewApi` mock, `useCountdown`, `useNextQuestionGuard`, `interviewHistoryApi`

### 3.2 미실행·수동 검증 필요

| 항목 | 상태 | 비고 |
|------|------|------|
| `InterviewApplicationTests` (Spring 전체 컨텍스트) | 환경 의존 | DB·LiveKit·JWT env 필요 시 실패 가능 |
| 2브라우저 E2E (A 생성 → B join → ready → 청취) | **수동** | Agent 연동 후 end-to-end 권장 |
| Agent 연동 후 실제 음성·순환 질문 | **수동** | Agent 미구현 구간 |

### 3.3 수동 테스트 체크리스트 (권장)

1. [ ] SOLO(1명): 기존처럼 생성 즉시 면접실 진입
2. [ ] GROUP(2명): 호스트 대기실 → sessionId 복사
3. [ ] 게스트 `/interview/join/{sessionId}` 입장
4. [ ] 둘 다 Ready → 자동 면접실 이동
5. [ ] 게스트: next/end 버튼 비활성
6. [ ] (Agent 연동 후) A 발화 시 B 청취
7. [ ] 종료 후 A/B 각각 본인 피드백만 조회

---

## 4. LiveKit Agent에서 해야 할 작업

> Backend/Frontend는 **계약(메타데이터·Data 채널·Internal API)** 까지 맞춰 둔 상태입니다.  
> 아래가 구현되기 전까지 **순환 질문·화자별 STT·실제 그룹 면접 UX**는 완성되지 않습니다.

### 4.1 Dispatch metadata 수신 (GROUP)

Agent Worker가 job metadata에서 다음을 파싱해야 합니다.

```json
{
  "mode": "GROUP",
  "sessionId": "sess-xxxxxxxx",
  "jobRole": "BACKEND",
  "maxParticipants": 2,
  "participants": [
    {
      "memberId": 1,
      "identity": "user-1",
      "name": "홍길동",
      "resumeText": "..."
    },
    {
      "memberId": 2,
      "identity": "user-2",
      "name": "김철수",
      "resumeText": "..."
    }
  ],
  "totalDurationSeconds": 900,
  "answerTimeLimitSeconds": 90,
  "resumeText": "...",
  "coverLetterText": "..."
}
```

**작업:**

- [ ] `mode === "GROUP"` 분기 (SOLO는 기존 로직 유지)
- [ ] `participants[]` 순서를 **화자 순환 인덱스**로 사용
- [ ] metadata 크기: 이력서全文 N명이면 수 KB 한도 — 필요 시 요약 또는 `resumeId` 참조로 축소 협의

### 4.2 Room Data Message — `START` (Backend → Agent)

전원 Ready 후 Backend가 Room에 전송합니다.

```json
{
  "type": "START",
  "payload": {
    "participants": [
      { "memberId": 1, "identity": "user-1", "name": "홍길동" },
      { "memberId": 2, "identity": "user-2", "name": "김철수" }
    ],
    "currentSpeakerIndex": 0,
    "targetIdentity": "user-1"
  }
}
```

**작업:**

- [ ] `START` 수신 전에는 **질문·TTS 시작하지 않음** (대기실 동안 Agent가 먼저 말하지 않도록)
- [ ] `currentSpeakerIndex` / `targetIdentity`로 **첫 화자** 결정
- [ ] 첫 `QUESTION` 발행 (아래 4.3)

### 4.3 Room Data Message — `QUESTION` (Agent → Frontend)

프론트 `InterviewRoom.jsx`가 수신·UI 반영합니다.

```json
{
  "type": "QUESTION",
  "payload": {
    "turnNumber": 1,
    "text": "자기소개를 해주세요.",
    "targetIdentity": "user-1"
  }
}
```

**작업:**

- [ ] TTS로 질문 발화 (기존 SOLO와 동일하게 **재생 완료 후** publish 권장 — §INTEGRATION_CONTRACT 3.5)
- [ ] `targetIdentity` **필수** 포함 (없으면 프론트가 전원에게 답변 타이머를 켤 수 있음)
- [ ] 질문 생성 시 해당 화자의 `resumeText`·`jobRole` 컨텍스트 반영

### 4.4 Room Data Message — `NEXT` (Backend → Agent)

호스트가 "다음 질문" 또는 답변 시간 만료 시 Backend가 전송합니다.

```json
{
  "type": "NEXT",
  "payload": {
    "turnNumber": 2,
    "targetIdentity": "user-2"
  }
}
```

`targetIdentity`는 Backend가 `currentSpeakerMemberId` 기준으로 넣을 수 있으나, **화자 순환은 Agent 책임**으로 두는 것이 자연스럽습니다.

**작업:**

- [ ] `NEXT` 수신 시 **직전 턴** QnA를 Internal API로 저장 (§4.5)
- [ ] 다음 화자 인덱스 증가 → 다음 `QUESTION` + `targetIdentity`
- [ ] 마지막 화자 이후: 첫 화자로 돌아가거나 면접 종료 정책 팀 합의

### 4.5 Internal API — QnA 저장

```
POST /internal/v1/interviews/sessions/{sessionId}/qnas
Header: X-Service-Token: {INTERNAL_SERVICE_TOKEN}
```

```json
{
  "turnNumber": 1,
  "question": "질문 텍스트",
  "intent": "기술역량",
  "isFollowUp": false,
  "answer": "STT 원문 (선택)",
  "answerSummary": ["요약 bullet"],
  "followUpDecision": "CONTINUE",
  "focusPoint": null,
  "respondentMemberId": 1
}
```

**작업:**

- [ ] **매 턴** 저장 (종료 시 일괄만 하지 않음 — 기존 계약)
- [ ] `respondentMemberId` **필수** (GROUP 평가가 발언자별로 필터링함)
- [ ] 실패 시 재시도(멱등 upsert: `sessionId` + `turnNumber`)

### 4.6 STT / 오디오 정책

프론트 정책:

- 답변 차례(`targetIdentity === myIdentity`)인 사람만 마이크 ON
- 그 외는 OFF, 다른 참가자 **원격 오디오 트랙 구독**으로 청취

**Agent 작업:**

- [ ] **활성 화자**의 오디오만 STT에 넣거나, identity로 발화 매핑
- [ ] 동시 다발화 시 diarization 없으면 품질 저하 — MVP는 **한 명만 publish** 전제와 맞춤
- [ ] Agent 트랙 구독: `user-*` identity는 면접자, 그 외는 면접관

### 4.7 Room Data Message — `END` (Backend → Agent)

```json
{
  "type": "END",
  "payload": { "reason": "USER_STOP" }
}
```

**작업:**

- [ ] 마지막 턴 QnA 저장
- [ ] 세션 종료·Room disconnect

### 4.8 SOLO 회귀

- [ ] `mode` 없음 또는 `"SOLO"` 시 **기존 Agent 동작** 유지
- [ ] `START` / `targetIdentity` 없이도 동작해야 함

---

## 5. 최종 예상 결과물 (Agent 완료 후)

### 5.1 사용자 관점

| 단계 | 기대 동작 |
|------|-----------|
| 대기실 | Agent 무음 대기, 참가자만 Ready |
| 시작 | 첫 참가자에게 음성 질문 + 화면에 질문·"내 차례" 표시 |
| 진행 | 화자 A 답변 → (호스트 next 또는 시간 만료) → 화자 B 질문 → … |
| 관전 | 비활성 참가자는 B의 답변을 **실시간으로 들음** |
| 종료 | 호스트 종료 → 각자 평가 대기 → **개인별** 피드백 리포트 |

### 5.2 시스템 관점

```
┌─────────────┐     REST      ┌──────────────┐     dispatch    ┌─────────────┐
│   React     │◄────────────►│ Spring Boot  │───────────────►│ LiveKit     │
│   Frontend  │   JWT        │   API        │                │   Agent     │
└──────┬──────┘              └──────┬───────┘                └──────┬──────┘
       │                            │                               │
       │ WebRTC                     │ Internal QnA                  │ WebRTC
       └────────────────────────────┴───────────────────────────────┘
                         같은 LiveKit Room (room-{uuid})
```

- DB: `interviews` 1건 + `interview_participants` N건 + `interview_qnas` (발언자 태그)
- 평가: participant별 `total_feedback` / Bedrock 호출 N회

### 5.3 완료 정의 (Definition of Done)

- [ ] GROUP 2명 E2E: 생성 → join → ready → 면접 → 순환 질문 2회 이상 → 종료 → 개별 피드백 2건
- [ ] SOLO 1명 회귀 테스트 통과
- [ ] `respondentMemberId`가 모든 GROUP QnA에 채워짐
- [ ] 프론트 `QUESTION.targetIdentity`와 Agent 화자 일치
- [ ] INTEGRATION_CONTRACT §11.8 체크리스트 전항목 ✅

---

## 6. 알려진 제한·리스크

| 항목 | 내용 |
|------|------|
| Agent 미구현 | 현재 GROUP 면접은 **대기실·입장·토큰·UI**까지 가능; **실제 AI 순환 질문은 불가** |
| metadata 크기 | 참가자별 `resumeText` 전문 → dispatch JSON 크기 제한 주의 |
| 동시 ready | `tryAutoStart` — prod에서 동시 PATCH 시 DB 락/조건부 update 권장(추가 hardening 가능) |
| 평가 비용 | 참가자 N명 × Bedrock 호출 |
| DB 마이그레이션 | prod `ddl-auto: validate` 환경은 `scripts/add-group-interview-support.sql` 수동 적용 |
| joinCode | 미구현 — `sessionId` 전체 문자열 공유 |

---

## 7. 관련 파일 빠른 참조

### Backend

- `InterviewService.java` — 핵심 분기
- `AgentDispatchService.java` — GROUP metadata
- `EvaluationService.java` — 참가자별 평가
- `InterviewController.java` — REST
- `scripts/add-group-interview-support.sql`

### Frontend

- `App.jsx`, `LobbyView.jsx`, `JoinInterviewView.jsx`
- `InterviewRoom.jsx`, `api/interviewApi.js`
- `INTEGRATION_CONTRACT.md` §11

### Agent (별도 레포)

- `agent.py` (또는 팀 Agent Worker) — §4 작업 대상
- `DISPATCH_CONTRACT.md` (있다면 §11과 동기화)

---

## 8. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-18 | Backend+Frontend GROUP MVP 구현, 본 문서 초안 |
