# AI 모의면접 시스템 — 통합 계약 문서

Backend(Spring Boot) · Frontend(React) · LiveKit Agent(Python) 세 컴포넌트 간의
API/메시지/데이터 계약을 정의한다. 각 담당자는 이 문서를 기준으로 자기 영역을 구현하며,
계약을 바꿀 때는 이 문서를 먼저 수정하고 합의한 뒤 코드에 반영한다.

## 문서 범위

이 문서는 **"면접 세션 생성부터 종료까지"** 사이에서 세 컴포넌트가 주고받는 것을 정의한다.

**포함**: 세션 생성 → Agent dispatch → 첫 질문 발화 → 답변 루프 → 다음/꼬리 질문 →
타이머 처리 → 종료 → QnA dump.

**범위 밖 (본 문서가 다루지 않음)**
- 회원가입/로그인/회원 정보 수정 (Auth 영역은 각 팀 별도 관리)
- 이력서/자소서 업로드·파싱 (면접 시작 이전)
- 종료 후 평가 파이프라인, 피드백 조회, 마이페이지 (면접 종료 이후)
- RAG 크롤링 파이프라인 (오프라인 작업)

각 컴포넌트가 **"면접 흐름을 위해" 구현해야 하지만 아직 구현되지 않은 부분**은
§9 구현 체크리스트에 정리되어 있다.

## 0. 문서 위치·소유

- 본 문서: 워크스페이스 루트 `INTEGRATION_CONTRACT.md`
- Agent metadata 상세 스펙: `livekit-agent/DISPATCH_CONTRACT.md` (본 문서의 4장과 일치)
- 변경 이력은 맨 아래 섹션에 누적

## 1. 시스템 구성

```
[Frontend (React)]
   │  REST(JSON, Bearer 토큰)
   ▼
[Backend (Spring Boot)] ──Dispatch──▶ [LiveKit Cloud] ──Job──▶ [Agent Worker (Python)]
   │                                                                 │
   └─ Bedrock 호출 없음                                        (in-process LLM)
                                                                     │
[Frontend] ◀──WebRTC──▶ [LiveKit Cloud] ◀──WebRTC──▶ [Agent]
                                                                     │
          ◀──Data Channel (QUESTION / NEXT / END)──▶
```

| 컴포넌트 | 책임 |
|----------|------|
| **Backend** | REST API, LiveKit token 발급, Agent dispatch, 세션/타이머 마스터, QnA 저장, 평가 |
| **Frontend** | 세션 생성 요청, LiveKit Room 접속, 카운트다운 UI, 버튼/종료 제어 |
| **Agent** | Room 참여, STT/TTS, LLM(Bedrock) 직접 호출, 질문 생성/발화 |

## 2. 용어

| 용어 | 정의 |
|------|------|
| **sessionId** | `sess-<uuid>` 형식. Backend 가 생성, 세 컴포넌트가 **같은 값을 공유** |
| **roomName** | LiveKit Room 이름. `room-<uuid>` 형식 (현재 sessionId 와 다른 UUID 사용) |
| **turnNumber** | 1부터 시작하는 질문-답변 순번. 꼬리질문도 별도 turn 으로 집계 |
| **answerTimeLimitSeconds** | 질문당 답변 제한 시간. 현재 `90` (1분 30초) 고정 |
| **totalDurationSeconds** | 면접 전체 제한 시간. `durationMinutes × 60` |


## 3. 핵심 의사결정

이 섹션은 "왜 이렇게 설계했나" 를 기록해 두는 것. 나중에 코드만 봐서는 이유를 알 수 없는
결정들을 여기 모아둔다.

### 3.1 Spring 이 모든 상태의 마스터
- 세션 생성·종료·타이머·QnA 저장은 전부 Spring 이 관리.
- Agent 는 "turnNumber 가 지금 몇 번인지" 같은 것을 몰라도 된다. Spring 이 NEXT 신호만 주면 됨.
- 근거: Spring 이 이미 DB/인증의 주인이므로 상태 일원화가 깔끔.

### 3.2 NEXT/END 신호는 LiveKit Data Channel
- 프론트 버튼이나 타이머 만료 시 Backend 가 `RoomServiceClient.sendData()` 로 Room 에
  바이너리 메시지(JSON utf-8) 를 실어 보내고 Agent 가 수신.
- Agent 를 별도 HTTP 서버로 만들지 않는다 (Worker 철학 유지).

### 3.3 이력서 전체 텍스트를 dispatch metadata 에 포함
- 현재: Spring 이 DB 에서 `resumeText` 를 꺼내 `dispatch.metadata.resumeText` 에 실어 전달.
- 한계: LiveKit dispatch metadata JSON 문자열은 **수 KB 내**가 안전. 약 10KB 이상이면
  전송 실패·지연 가능성.
- **미래 마이그레이션 경로 (지금은 구현 안 함)**: `resumeId` 만 넘기고 Agent 가 Spring 의
  `GET /v1/resumes/{id}/text` 같은 엔드포인트로 조회. 이력서가 커지거나 PDF 파싱 결과가
  복잡해질 때 전환.

### 3.4 QnA 는 매 턴 실시간 저장
- 턴이 넘어가는 순간(Agent 가 NEXT 를 받거나 END 를 받을 때) 직전 턴의 Q+A 를
  Backend 로 즉시 POST 하여 DB 에 저장한다.
- 장점:
  - Agent 프로세스가 중간에 죽어도 **이미 저장된 턴은 보존**된다.
  - 관리자·개발자가 진행 중 DB 를 조회해 상태 확인·디버깅 가능.
  - 실패 시 재시도 단위가 작아 트랜잭션 복잡도가 낮다.
- 단점: 매 턴 네트워크 홉 1회 추가. 초당 요청량은 무시 가능 수준(턴 간격 ≥ 수십 초).
- 멱등성 보장: `(session_id, turn_number)` 유니크 제약 + Backend 에서 upsert 처리.
  네트워크 재시도로 같은 턴이 두 번 도착해도 DB 는 같은 상태를 유지한다.

### 3.5 질문 텍스트는 Agent 가 프론트로 Data Message 전송
- 프론트 `InterviewRoom.jsx` 의 `Q{turn}. {currentQuestion}` UI 를 유지하기 위함.
- Agent 가 TTS 로 발화하고 **오디오 재생이 끝난 뒤** `{type: "QUESTION", ...}` 메시지를
  Room 에 publish. 프론트는 메시지 수신 시점에 UI 를 갱신한다.
- 이유: 이 시스템의 기본 모달리티는 **음성**, 텍스트는 "참고용" 이다. 오디오로 질문을
  듣고 생각을 시작한 뒤 필요 시 텍스트로 확인하는 흐름을 유지하려면 텍스트가
  오디오보다 먼저 뜨면 안 된다 (사용자 집중력 분산).
- Backend 는 이 메시지에 관여하지 않는다 (Agent ↔ Frontend 직통).
- **현재 구현 상태**: ❌ 미구현. Agent 는 `session.say(...)` / `yield` 로 TTS 만 송출 중.
  §5.4 스펙대로 `QUESTION` 메시지 publish 를 반드시 추가해야 프론트 UI 가 동작한다.


## 4. Spring ↔ Frontend REST API

### 4.1 공통 규칙

- **Base URL**: `/v1`
- **Interview Base**: `/v1/interviews`
- **Auth Base**: `/v1/auth`
- **인증**: `Authorization: Bearer <accessToken>` 헤더. `/v1/auth/signup`, `/v1/auth/login`,
  `OPTIONS /**` 만 permitAll. 그 외 엔드포인트는 모두 JWT 필요.
- JWT 검증은 `JwtAuthenticationFilter` 에서 수행. 성공 시 SecurityContext 에
  `loginId` 를 principal 로 세팅.
- **Content-Type**: `application/json; charset=utf-8`
- **Key naming**: camelCase (Spring record / Frontend 패턴).
- **성공 응답**: `{ "success": true, "data": { ... } }` 또는
  `{ "success": true, "message": "...", "data": { ... } }`
- **에러 응답** (`exception/ErrorResponse` 형식 그대로):
  ```json
  {
    "status": 400,
    "code": "VALIDATION_ERROR",
    "message": "요청 값이 올바르지 않습니다",
    "timestamp": "2026-05-11T16:20:00"
  }
  ```

### 4.2 POST `/v1/interviews/sessions` — 세션 생성

**인증**: 필수 (Bearer 토큰)

**Request** — `dto/SessionCreateRequest` 그대로 유지
```json
{
  "resumeIds": 1,
  "coverLetter": 3,
  "jobField": "BACKEND",
  "durationMinutes": 15
}
```
> 주의: 필드명 `resumeIds`(단수), `coverLetter`(Id 접미사 없음)는 현재 코드
> 컨벤션을 따르기 위해 유지한다. 일관성 개선이 필요하면 Spring/Frontend 동시
> 마이그레이션으로 추후 정리.
- `resumeIds`, `coverLetter`: 둘 다 optional. 하나 이상 있어야 RAG 활용 가능.
- `jobField`: required. `BACKEND | FRONTEND | ANDROID | IOS | DEVOPS | DATA | AI`
- `durationMinutes`: required. 10~60 범위 권장.

**Response 200** — `dto/SessionCreateResponse` 확장
```json
{
  "success": true,
  "data": {
    "sessionId": "sess-uuid",
    "livekit": {
      "roomName": "room-uuid",
      "url": "wss://your-livekit-url",
      "accessToken": "<JWT>"
    },
    "answerTimeLimitSeconds": 90,
    "totalDurationSeconds": 900
  }
}
```

**Backend 처리 순서** (현재 `InterviewService.createSession` 기준)
1. 요청 검증 → 2. `SecurityContextHolder` 에서 loginId → Member 로드 →
3. resumeId/coverLetterId 로 엔티티 조회 →
4. `Interview` 저장 (member 연관 포함) → 5. LiveKit Room 이름·token 생성 →
6. `resume.originalText`, `coverLetter.originalText` 로드 →
7. `AgentDispatchService.createDispatch()` 호출 (metadata 포함, §5.1 참고).
8. **첫 턴 초기화**: Interview 또는 InterviewQna 테이블에 `turnNumber=1`, `startedAt=now()`,
   `expiresAt=now()+answerTimeLimitSeconds` 기록. 이후 `/next` 첫 호출은 1→2 전이로 처리.

**Agent dispatch 실패 처리**
- dispatch 호출이 실패하면 `Interview.status=FAILED` 로 전이하고 `INTERNAL_ERROR` 응답.
- 부분적으로 성공했는데 Agent 가 Room 에 끝내 들어오지 않는 경우 Frontend 쪽에서
  타임아웃 처리 필요 (§9.2 체크리스트 참고).

### 4.3 POST `/v1/interviews/sessions/{sessionId}/next` — 다음 질문 (신규)

**인증**: 필수 (Bearer 토큰). 본인 세션인지 Backend 가 검증.

프론트 "다음 질문" 버튼 또는 프론트 답변 타이머 만료 시 호출.

**Request**
```json
{ "currentTurnNumber": 2 }
```
- `currentTurnNumber`: 프론트가 알고 있는 현재 턴 번호 (서버 상태와 일치 검증용).

**Response 200**
```json
{
  "success": true,
  "data": {
    "turnNumber": 3,
    "startedAt": "2026-05-11T16:20:00Z",
    "expiresAt": "2026-05-11T16:21:30Z"
  }
}
```

**Backend 처리 순서**
1. 세션 상태 확인 (`IN_PROGRESS` 만 허용) →
2. turn 번호 증가 → 3. `startedAt/expiresAt` 기록 →
4. `RoomServiceClient.sendData()` 로 Agent 에 `{"type":"NEXT", "turnNumber":N}` 전송.

**sendData 실패 처리**
- `sendData()` 가 예외를 던지거나 비정상 응답이면 **turn 증가·타이머 기록을 롤백**하고
  `INTERNAL_ERROR (500)` 로 응답한다. Frontend 는 동일 요청을 재시도할 수 있다.
- 부분 성공(Backend 상태는 변경됐는데 Agent 전달 실패) 상태를 DB에 남기지 않는 것이 원칙.
- 원자성 보장: Backend 는 `sendData()` 결과를 확인한 뒤에만 트랜잭션을 커밋한다.

### 4.4 POST `/v1/interviews/sessions/{sessionId}/end` — 세션 종료 (기존)

**인증**: 필수 (Bearer 토큰). 본인 세션인지 Backend 가 검증.

**Request**
```json
{ "reason": "USER_STOP" }
```
- `reason`: `USER_STOP | TIME_OVER`

**Response 200** (변경 없음)
```json
{
  "success": true,
  "message": "면접이 종료되었습니다. AI 피드백을 생성 중입니다.",
  "data": { "status": "COMPLETED" }
}
```

**Backend 처리 순서**
1. 세션 상태 `COMPLETED` 로 전환 →
2. Agent 에 `{"type":"END"}` Data Message 전송 →
3. Agent 가 **마지막 턴** 의 Q+A 를 `POST /internal/.../qnas` 로 저장
   (그 이전 턴들은 이미 매 턴마다 저장 완료) →
4. 비동기 평가 파이프라인 트리거.

**sendData 실패 처리 (END 경로)**
- `/next` 와 달리 END 는 실패해도 상태를 롤백하지 않는다. 이유: 사용자가 이미 종료를
  원했고, Agent 가 Data Message 를 못 받아도 LiveKit Room 자체를 `deleteRoom` 으로
  정리하면 Agent 프로세스가 연결 종료로 자연스럽게 shutdown 된다.
- 구현 권장 순서:
  1. sendData END 시도 (실패해도 로그만 남기고 계속)
  2. `RoomServiceClient.deleteRoom()` 호출 — Agent 강제 연결 종료
  3. 세션 상태 COMPLETED 전환, 응답 반환
- 부작용: Agent 가 END 를 못 받으면 **마지막 턴 QnA 저장이 누락**될 수 있다.
  평가 단계에서 "해당 턴 누락" 으로 처리하고 나머지 턴으로 피드백 생성 (degrade).

### 4.5 에러 코드 (면접 API 한정)

`ErrorResponse { status, code, message, timestamp }` 포맷. `GlobalExceptionHandler` 매핑 기준.

| code | HTTP | 예외 | 면접 API 에서의 발생 예 |
|------|------|------|------|
| `VALIDATION_ERROR` | 400 | `IllegalArgumentException` | 필수 필드 누락, 존재하지 않는 resumeId |
| `UNAUTHORIZED` | 401 | `UnauthorizedException` | JWT 만료·위조, 타인 세션 접근 시도 |
| `INTERNAL_ERROR` | 500 | 그 외 `Exception` | LiveKit dispatch 실패, DB 오류 |

> `SESSION_NOT_FOUND (404)`, `INVALID_STATE (409)` 는 전용 예외 클래스를 추가해
> `GlobalExceptionHandler` 에 매핑하는 것을 권장. 현재는 `IllegalArgumentException`
> 으로 400 처리.


## 5. Spring ↔ Agent

### 5.1 Dispatch: Job Metadata

Backend 는 `/v1/interviews/sessions` 처리 중 LiveKit Agent 를 dispatch 한다.
metadata 는 UTF-8 JSON 문자열.

```json
{
  "sessionId": "sess-uuid",
  "jobRole": "BACKEND",
  "resumeText": "이력서 원문 전체",
  "coverLetterText": "자소서 원문 전체 (선택)",
  "totalDurationSeconds": 900,
  "answerTimeLimitSeconds": 90
}
```

| 필드 | 필수 | 설명 |
|------|------|------|
| `sessionId` | ✓ | 시스템 전체 공유 식별자 |
| `jobRole` | ✓ | `jobField` 와 동일 값 |
| `resumeText` | 선택 | 이력서 원문. 없으면 빈 문자열 |
| `coverLetterText` | 선택 | 자소서 원문. 없으면 빈 문자열 |
| `totalDurationSeconds` | 선택 | Agent 는 타이머를 직접 관리하지 않지만 로깅/안전장치에 사용 가능 |
| `answerTimeLimitSeconds` | 선택 | 위와 같음 |

**Java SDK 호출 예시 (Backend 담당자 참고용)**
```java
AgentDispatch dispatch = AgentDispatch.newBuilder()
    .setRoom(roomName)
    .setAgentName("interviewer-agent")
    .setMetadata(objectMapper.writeValueAsString(Map.of(
        "sessionId", sessionId,
        "jobRole", jobField,
        "resumeText", resumeText == null ? "" : resumeText,
        "coverLetterText", coverLetterText == null ? "" : coverLetterText,
        "totalDurationSeconds", durationMinutes * 60,
        "answerTimeLimitSeconds", 90
    )))
    .build();
agentDispatchService.createDispatch(dispatch);
```

**이력서 크기 주의**: 3.3 참고. 10KB 이상이면 향후 `resumeId` 참조 방식으로 전환 필요.

### 5.2 Data Message 프로토콜

LiveKit Room 의 Data Channel(신뢰성 모드) 을 사용. 메시지는 **UTF-8 JSON 바이트**.

```
{ "type": <string>, "payload": <object> }
```

### 5.3 Backend → Agent 메시지

#### `NEXT` — 다음 질문 요청
```json
{ "type": "NEXT", "payload": { "turnNumber": 3 } }
```
Agent 수신 시 처리 순서:
1. **사용자 답변 확정**: STT 버퍼에 누적된 텍스트를 `session.add_answer()` 로 직전 턴에 기록 (§5.3.1 참고)
2. **직전 턴 저장**: 현재 진행 중이던 턴의 Q+A 를 `POST /internal/.../qnas` 로 저장 (§5.5)
   — fire-and-forget (§5.5 비동기 처리 참고)
3. 다음 질문 생성: `generate_next_topic()` 또는 (판단 AI 추가 후) `generate_follow_up()`
4. TTS 발화 → 재생 완료 후 `QUESTION` 메시지 publish (§5.4)
5. (선택) `payload.turnNumber` 가 `len(session.history) + 1` 과 다르면 경고 로그.
   Agent 는 이후에도 Backend 값을 신뢰하고 진행한다.

#### `END` — 면접 종료
```json
{ "type": "END", "payload": { "reason": "USER_STOP" } }
```
Agent 수신 시 처리 순서:
1. **사용자 답변 확정**: STT 버퍼 내용을 마지막 턴에 `add_answer()` 로 기록
2. **마지막 턴 저장**: `POST /internal/.../qnas` — **이 호출만큼은 `await` 로 기다린다**.
   프로세스가 곧 종료되므로 fire-and-forget 하면 태스크가 유실될 수 있다.
3. `session.shutdown()` 호출

### 5.3.1 STT 버퍼링 (Agent 내부)

VAD 기반 자동 턴 종료를 끈 상태에서는 STT 결과를 **Agent 가 스스로 모아둬야** 한다.

- `AgentSession.on("user_input_transcribed")` 이벤트에 핸들러를 등록.
- `is_final=True` 인 조각만 이어붙여 `InterviewSession` 내부 버퍼(`current_answer_buffer`)에 누적.
- NEXT/END 수신 시점에 버퍼 내용을 `session.add_answer(buffer)` 호출로 flush 하고 버퍼 초기화.
- 사용자가 한 마디도 안 하고 턴이 넘어가도 버퍼는 빈 문자열. `answer = ""` 로 저장된다 (§5.5 주의 3).

### 5.4 Agent → Frontend 메시지

Agent 가 TTS 로 발화하는 순간 동시에 Room 에 publish. 프론트는 질문 UI 갱신용으로 수신.

#### `QUESTION` — 새 질문
```json
{
  "type": "QUESTION",
  "payload": {
    "turnNumber": 3,
    "text": "분산 락에서 TTL 을 어떻게 설정하셨나요?",
    "intent": "운영 경험 확인",
    "isFollowUp": false
  }
}
```

##### 구현 가이드 (Agent 담당)

**발행 시점**: **TTS 오디오 재생이 완료된 직후** publish 한다.
음성이 기본 모달리티이고 텍스트는 참고용이므로, 텍스트가 먼저 뜨면 사용자 집중을
방해한다. 오디오가 끝나고 텍스트가 뜨는 흐름을 지킨다.

- `on_enter()` 에서는 `await self.session.say(text)` 가 재생 완료까지 기다리므로
  그 이후 줄에 publish 를 배치한다.
- `llm_node()` 에서는 `yield` 로 파이프라인이 넘긴 텍스트가 TTS 되기 때문에
  직접 완료 시점을 알기 어렵다. LiveKit 의 speech handle 완료 이벤트
  (예: `session.on("agent_speech_committed")` 또는 speech handle 의 `await .wait_for_playout()`)
  를 활용해 "재생 완료" 콜백에서 publish 한다. 실제 API 는 현재 설치된
  `livekit-agents` 버전에 맞춰 확인 후 반영한다.

**turnNumber 계산**: Agent 는 별도 카운터를 두지 않고 `InterviewSession.history` 길이로
결정한다. `generate_*` 메서드가 내부적으로 `session.add_question()` 을 호출하므로,
publish 시점 기준 `len(session.history)` 가 곧 현재 턴 번호다.

**전송 방법**: `ctx.room.local_participant.publish_data()` 사용. 신뢰성 모드
(`reliable=True`) 로 전송해 누락을 방지한다.

```python
import json
from livekit import rtc

async def _publish_question(
    room: rtc.Room,
    session: InterviewSession,
    result: dict,  # {"question": str, "intent": str}
    is_follow_up: bool,
) -> None:
    payload = {
        "type": "QUESTION",
        "payload": {
            "turnNumber": len(session.history),
            "text": result["question"],
            "intent": result.get("intent", ""),
            "isFollowUp": is_follow_up,
        },
    }
    await room.local_participant.publish_data(
        payload=json.dumps(payload).encode("utf-8"),
        reliable=True,
        topic="interview",  # 프론트 필터링용 (선택)
    )
```

**적용 위치** (`agent.py`):
1. `InterviewerAgent.on_enter()` — `await self.session.say(...)` 가 끝난 직후 publish.
2. `InterviewerAgent.llm_node()` — 재생 완료 이벤트 훅에서 publish.
   (구현 힌트: `yield` 전에 콜백을 예약하거나, `on_enter` 와 동일 패턴으로
   `say()` 를 직접 호출하는 경로로 전환해도 된다.)

**주의 사항**:
- `generate_next_topic()` / `generate_follow_up()` 내부에서 이미
  `session.add_question()` 이 호출되므로, publish 전에 history 길이만 읽으면 된다.
- 판단 AI 추가 시 `isFollowUp` 을 동적으로 결정한다.
- publish 실패는 치명적이지 않으므로 `try/except` 로 감싸고 로그만 남긴다
  (음성은 이미 나갔으므로 면접 진행은 계속).

##### 프론트 수신 가이드 (Frontend 담당)

```javascript
room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
  const msg = JSON.parse(new TextDecoder().decode(payload));
  if (msg.type === "QUESTION") {
    setCurrentTurn(msg.payload.turnNumber);
    setCurrentQuestion(msg.payload.text);
    // UI: `Q${msg.payload.turnNumber}. ${msg.payload.text}`
  }
});
```

- `topic === "interview"` 로 필터링하면 다른 메시지와 섞일 때 안전.
- `turnNumber` 는 Backend `/next` 응답의 `turnNumber` 와 일치해야 하며, 불일치 시
  Agent 쪽 이력이 단절된 것이므로 경고 로그를 남긴다.

#### `TRANSCRIPT` — 사용자 답변 STT 결과 (선택, 차후 구현)
```json
{
  "type": "TRANSCRIPT",
  "payload": { "turnNumber": 3, "text": "네 저는 ...", "isFinal": true }
}
```

### 5.5 Agent → Backend: QnA 실시간 저장 (매 턴)

턴이 끝나는 시점마다 Agent 가 HTTP POST 로 해당 턴의 Q+A 를 저장한다.

**저장 트리거**
- `NEXT` 수신 시 → **직전 턴**(막 끝난 턴)의 Q+A 저장
- `END` 수신 시 → **현재(마지막) 턴**의 Q+A 저장 후 `session.shutdown()`

**엔드포인트**
```
POST /internal/v1/interviews/sessions/{sessionId}/qnas
Authorization: Bearer <service-token>
```

**Request** (단건)
```json
{
  "turnNumber": 2,
  "question": "분산 락에서 TTL 을 어떻게 설정하셨나요?",
  "intent": "운영 경험 확인",
  "isFollowUp": false,
  "answer": "사용자 답변 (STT 텍스트, 비어있을 수 있음)"
}
```

**Response 200** `{ "success": true }`

**멱등성·중복 처리**
- Backend 는 `(sessionId, turnNumber)` 를 유니크 키로 삼아 **upsert** 한다.
  JPA 기준 `INSERT ... ON CONFLICT (session_id, turn_number) DO UPDATE` 또는
  조회 후 update/insert 분기.
- 같은 턴이 재시도로 두 번 도착해도 DB 는 최종 상태 하나만 유지한다.
- Agent 쪽은 POST 실패 시 최대 N회(예: 3회) 지수 백오프 재시도. 최종 실패 시
  에러 로그만 남기고 면접 진행은 계속한다 (데이터 손실 감수 > 면접 중단).

**비동기 처리 (중요)**
- Agent 는 QnA 저장을 **fire-and-forget** 방식으로 백그라운드 실행한다.
  `asyncio.create_task(save_qna(...))` 로 예약만 하고 **기다리지 않고** 바로
  다음 질문 생성으로 넘어간다.
- **예외: END 경로는 동기로 `await`**. 프로세스가 곧 `shutdown()` 되기 때문에
  백그라운드 태스크를 띄우면 미완료 상태로 종료될 수 있다.
  END 수신 시 저장 완료를 기다렸다가 shutdown.
- 이유: 저장(20~80ms) 자체는 짧지만, 면접 흐름이 네트워크/DB 상태에 의존하게
  되면 장애 시 질문 발화가 멈춘다. 저장은 보조 작업이므로 메인 플로우를 막으면 안 됨.
- 재시도 / 실패 로깅은 백그라운드 태스크 내부에서 수행.
- 프로세스 종료 시 미완료 태스크 보존: `ctx.add_shutdown_callback` 으로 pending
  저장 태스크를 drain (타임아웃 3~5초) 한 뒤 shutdown.

```python
# 개념 코드 (agent.py 적용 시 참고용)
async def _save_qna_bg(turn_data: dict) -> None:
    for attempt in range(3):
        try:
            await http.post("/internal/.../qnas", json=turn_data)
            return
        except Exception as e:
            logger.warning("QnA 저장 실패 (시도 %d): %s", attempt + 1, e)
            await asyncio.sleep(2 ** attempt)
    logger.error("QnA 저장 최종 실패: turnNumber=%s", turn_data["turnNumber"])

# NEXT 수신 핸들러 내부
def on_next(turn_number: int):
    prev_turn = session.history[-1]
    asyncio.create_task(_save_qna_bg(prev_turn.to_payload()))  # 안 기다림
    # 바로 다음 질문으로 진행
```

**주의 1**: `/internal/` 경로는 사용자 토큰이 아닌 서버 간 통신용 별도 인증을 쓴다.
구체 토큰 전략은 배포 단계에서 결정 (HMAC, service account 등).

**주의 2**: 현재 `SecurityConfig` 는 `/v1/auth/signup`, `/v1/auth/login`, `OPTIONS /**`
외 모든 엔드포인트에 JWT 를 요구한다. `/internal/**` 엔드포인트 도입 시
`SecurityFilterChain` 의 `authorizeHttpRequests` 에 **전용 permitAll + 별도 서비스
토큰 검증 필터** 를 추가해야 한다. 그냥 permitAll 만 달면 외부에서도 호출 가능해짐.

**주의 3**: `answer` 필드는 STT 결과가 비어 있을 수 있다 (무응답 턴).
빈 문자열로 저장하고 평가 단계에서 판단한다.


## 6. 타이머 정책

### 6.1 두 종류의 타이머
- **전체 타이머** (`totalDurationSeconds`): 면접 총 시간. 0 에 도달하면 `TIME_OVER` 로 자동 종료.
- **답변 타이머** (`answerTimeLimitSeconds`, 현재 90초 고정): 질문당 제한 시간.

### 6.2 마스터: Backend
- 모든 턴의 `startedAt/expiresAt` 은 Backend 가 기록·소유.
- Frontend 는 Backend 가 돌려준 타임스탬프를 기준으로 로컬 카운트다운만 수행.

### 6.3 Frontend 카운트다운 (현재 구현된 `useCountdown` 활용)
- 새 턴 시작 시 Backend 가 응답에 `expiresAt` 포함 → Frontend 는
  `expiresAt - Date.now()` 로 남은 시간 계산 후 매초 감소 표시.
- 10초 전 경고 UI (`WARNING_THRESHOLD`) 는 기존 로직 유지.

### 6.4 답변 타이머 만료 처리
- Frontend: `onAnswerTimerExpire()` 에서 `POST /next` 자동 호출.
- Backend: 호출 수신 시 `now > expiresAt + gracePeriod(5초)` 라면 경고 로그만 남기고 진행.
- Agent: Backend 가 Data Message 로 NEXT 를 보내는 순간까지 아무것도 하지 않음.

### 6.5 전체 타이머 만료 처리
- Frontend: `durationMinutes × 60` 만료 시 `POST /end` 를 `TIME_OVER` 로 호출.
- Backend: `END` 메시지를 Agent 에 전파하고 세션 종료.

## 7. 면접 흐름 (시퀀스)

```
Frontend                 Backend                 LiveKit Cloud            Agent
   │  POST /sessions         │                         │                       │
   ├─────────────────────────▶                         │                       │
   │                         │  Interview 저장          │                       │
   │                         │  Room 이름·token 생성     │                       │
   │                         │  dispatch(metadata)     │                       │
   │                         ├────────────────────────▶│  worker 에게 job 배포   │
   │                         │                         ├──────────────────────▶│
   │ ◀──sessionId+livekit────┤                         │                       │
   │                         │                         │        (Agent 부팅)    │
   │  connect(wss, token)    │                         │                       │
   ├─────────────────────────┼────────────────────────▶│                       │
   │                         │                         │ ◀─── Agent 접속 ─────  │
   │                         │                         │                       │
   │                         │                         │ on_enter → 첫 질문 TTS │
   │ ◀═════════오디오═════════│═════════════════════════│═══════════════════════│
   │ ◀─ QUESTION(turn=1) ─(data channel)─────────────────────────────────────── │
   │                         │                         │                       │
   │ 사용자 답변 음성          │                         │                       │
   │ ══════════오디오═════════▶│═════════════════════════│═══════════════════════▶│
   │                         │                         │ STT 처리                │
   │                         │                         │                       │
   │ "다음" 버튼 클릭           │                         │                       │
   ├── POST /next ──────────▶│                         │                       │
   │                         │ turn 증가, expiresAt 기록 │                       │
   │                         │ sendData({NEXT, turn=2})│                       │
   │                         ├────────────────────────▶│ ───────────────────────▶│
   │ ◀─ {turn, expiresAt} ───┤                         │  Agent:                │
   │ (카운트다운 리셋)         │                         │  ① 직전 턴 Q+A 저장      │
   │                         │ ◀─ POST /internal/qnas ─────────────────────────┤
   │                         │  (turnNumber=1 upsert)  │                       │
   │                         │                         │  ② 다음 질문 생성        │
   │                         │                         │  ③ TTS 재생 → 완료 후    │
   │                         │                         │     QUESTION publish   │
   │ ◀═════════오디오═════════│═════════════════════════│═══════════════════════ │
   │ ◀─ QUESTION(turn=2) ─────────────────────────────────────────────────────  │
   │                         │                         │                       │
   │ (반복)                   │                         │                       │
   │                         │                         │                       │
   │ 종료 (버튼 or 타이머)      │                         │                       │
   ├── POST /end ───────────▶│                         │                       │
   │                         │ sendData({END})         │                       │
   │                         ├────────────────────────▶│ ───────────────────────▶│
   │                         │                         │ Agent: 마지막 턴 저장    │
   │                         │ ◀─ POST /internal/qnas ─────────────────────────┤
   │                         │ 평가 파이프라인 트리거     │ session.shutdown()     │
   │ ◀── {status:COMPLETED}──┤                         │                       │
```

## 8. 세션 상태 머신

```
READY ──start()──▶ IN_PROGRESS ──complete()──▶ COMPLETED
                       │
                       └──fail()──▶ FAILED
```

- **READY**: Interview 엔티티 생성 직후. 실질적으로는 createSession 내부에서 즉시 IN_PROGRESS 로 전이.
- **IN_PROGRESS**: 면접 진행 중. `/next`, `/end` 가능.
- **COMPLETED**: 정상 종료. `/end` 이후 평가 생성 중/완료.
- **FAILED**: 예외 상황 (Agent dispatch 실패, LLM 장기 다운 등). 사용자에게 안내 후 환불/재시도.

## 9. 구현 체크리스트 (면접 흐름 관련)

"면접 시작~종료" 흐름을 정상 동작시키기 위해 **현재 미구현이거나 보완이 필요한** 항목.
각 담당자가 이 표만 보고 작업을 끝낼 수 있도록 참조 위치를 같이 둔다.

### 9.1 Backend (Spring)

| 상태 | 작업 | 위치/참조 |
|------|------|-----------|
| ❌ | `POST /v1/interviews/sessions/{id}/next` 엔드포인트 신설 | §4.3 |
| ❌ | `Interview.start()` 이후 `AgentDispatchService.createDispatch()` 호출. 실패 시 `FAILED` 전이 + `INTERNAL_ERROR` 응답 | `InterviewService.createSession`, §4.2, §5.1 |
| ❌ | `resume.originalText` / `coverLetter.originalText` 를 metadata 에 포함 | §5.1 |
| ❌ | `/next` 수신 시 `RoomServiceClient.sendData()` 로 Agent 에 NEXT 전달. 실패 시 turn 증가 롤백 + `INTERNAL_ERROR` 응답 | §4.3, §5.3 |
| ❌ | `/end` 수신 시 Agent 에 END 메시지 전달 → 실패해도 `deleteRoom()` 로 Room 정리 | §4.4, §5.3 |
| ❌ | 턴 타이머 필드 (`startedAt`, `expiresAt`) 저장. `InterviewQna` 또는 별도 테이블 | §6.2 |
| ❌ | `/next`, `/end` 요청 시 세션 소유자(로그인 사용자 = interview.member) 검증 | §4.3, §4.4 |
| ❌ | `POST /internal/v1/interviews/sessions/{id}/qnas` 신설 + 서비스 토큰 검증 필터 + `(session_id, turn_number)` 유니크 제약 및 upsert 처리 | §5.5 |
| ❌ | 세션 생성 응답에 `answerTimeLimitSeconds`, `totalDurationSeconds` 필드 추가 | §4.2 |

### 9.2 Frontend (React)

| 상태 | 작업 | 위치/참조 |
|------|------|-----------|
| ✅ | 세션 생성 API 호출 (`createInterviewSession`) | `api/interviewApi.js` |
| ✅ | LiveKit Room 접속 | `InterviewRoom.jsx` |
| ✅ | 카운트다운 UI | `useCountdown.js` |
| ❌ | `QUESTION_BANK` 하드코딩 제거. Agent 로부터 `DataReceived` 로 질문 수신 | §5.4 |
| ❌ | "다음 질문" 버튼을 `POST /next` 호출로 연결 (현재 로컬 `setTurn` 만 함) | §4.3 |
| ❌ | 답변 타이머 만료 시 `POST /next` 자동 호출 | §6.4 |
| ❌ | `/next` 응답의 `expiresAt` 기반으로 카운트다운 리셋 | §6.3 |
| ⚠️ | 전체 타이머 만료 시 `/end` 를 `TIME_OVER` 로 호출 (이미 구현, 실제 Backend 연동 확인 필요) | §6.5 |
| ❌ | 세션 생성 후 Agent 접속 대기(예: Room 에서 Agent participant 등장) 타임아웃 처리. 10초 이상 Agent 없으면 에러 화면 | §4.2 |

### 9.3 LiveKit Agent (Python)

| 상태 | 작업 | 위치/참조 |
|------|------|-----------|
| ✅ | Dispatch metadata 파싱 (`sessionId`, `jobRole`, `resumeText`) | `agent.py::_load_metadata` |
| ✅ | `on_enter` 에서 첫 질문 생성 + TTS | `agent.py::InterviewerAgent.on_enter` |
| ✅ | `llm_node` 에서 다음 질문 생성 + TTS | `agent.py::InterviewerAgent.llm_node` |
| ❌ | metadata 에 `coverLetterText` 수신·활용. 현재는 `resumeText` 만 사용 | §5.1, `agent.py::_load_metadata` |
| ❌ | Data Message 수신 핸들러 등록 (`room.on("data_received")`) | §5.3 |
| ❌ | `NEXT` 수신 시: ① 직전 턴을 `/internal/.../qnas` 로 저장 ② 다음 질문 생성·발화 | §5.3, §5.5 |
| ❌ | `END` 수신 시: ① 마지막 턴 저장 ② `session.shutdown()` | §5.3, §5.5 |
| ❌ | 질문 TTS 재생 완료 후 `QUESTION` 메시지를 Room 에 publish | §3.5, §5.4 |
| ❌ | QnA 저장 POST 구현 및 실패 시 지수 백오프 재시도 | §5.5 |
| ⚪ | (차후) 꼬리질문 판단 AI (`FollowUpJudge`) 추가 및 `llm_node` 내부 분기 | §5.3 |
| ❌ | `user_input_transcribed` 이벤트 핸들러로 STT 결과를 `current_answer_buffer` 에 누적 | §5.3.1 |
| ❌ | NEXT/END 수신 시 STT 버퍼를 `session.add_answer()` 로 flush | §5.3.1 |
| ❌ | `on_enter` 에서 사용자 참가 대기 후 첫 질문 발화 (`ctx.wait_for_participant()`) — Frontend 가 Room 접속 전에 발화하면 첫 질문을 놓친다 | §5.3 |

범례: ✅ 구현됨 · ❌ 미구현 · ⚠️ 부분 구현 (추가 연동 필요) · ⚪ 차후 계획


## 10. 변경 이력

| 날짜 | 변경 내용 | 담당 |
|------|----------|------|
| 2026-05-11 | 초안 작성. Dispatch metadata + Data Message 프로토콜 확정 | Agent 담당 |
| 2026-05-12 | Spring Security + JWT 인증 도입 반영. `SessionCreateRequest` 필드명은 현행 유지로 확정. 에러 코드 `UNAUTHORIZED` 추가 | Agent 담당 |
| 2026-05-12 | §3.5 / §5.4 에 `QUESTION` Data Message 구현 가이드 추가 (현재 미구현) | Agent 담당 |
| 2026-05-12 | 문서 범위를 "면접 시작~종료 사이"로 명시. Auth 요약(§4.6) 제거. §4.5 에러 코드를 면접 API 한정으로 축소. §9 를 "미래 확장" 대신 "구현 체크리스트"로 교체 | Agent 담당 |
| 2026-05-12 | `QUESTION` 메시지 발행 시점을 "TTS 발화 직전" → "**TTS 재생 완료 직후**" 로 변경. 음성이 기본, 텍스트는 참고용이라는 UX 원칙 반영 | Agent 담당 |
| 2026-05-12 | QnA 저장 정책을 "**종료 시 일괄**" → "**매 턴 실시간 저장**" 으로 변경. `(sessionId, turnNumber)` 유니크 + upsert 로 멱등성 보장. Agent 크래시 시 부분 데이터 보존 | Agent 담당 |
| 2026-05-12 | QnA 저장을 **fire-and-forget 백그라운드 태스크**로 수행하도록 명시. 면접 메인 플로우가 저장 지연/실패에 영향받지 않도록 분리 | Agent 담당 |
| 2026-05-12 | 흐름 구멍 메꿈: ① STT 버퍼링 규칙(§5.3.1), ② `on_enter` 첫 질문 발화 전 사용자 참가 대기, ③ END 경로만 동기 저장, ④ dispatch 실패 시 `FAILED` 전이, ⑤ Frontend Agent 접속 타임아웃, ⑥ 첫 턴(turnNumber=1) 초기화 규칙 | Agent 담당 |
| 2026-05-12 | `sendData` 실패 정책 명시: `/next` 는 롤백+500, `/end` 는 `deleteRoom()` 로 정리 후 정상 응답 | Agent 담당 |
| 2026-05-18 | **그룹 면접 (Backend+Frontend, Agent 미구현)**: `WAITING` 상태, `maxParticipants`, lobby/join/ready API, dispatch `mode=GROUP` + `participants[]`, Room Data `START`, `QUESTION.targetIdentity`, Internal QnA `respondentMemberId`, 참가자별 평가 | Backend+Frontend |

## 11. 그룹 면접 (GROUP mode) — Backend/Frontend 구현 스펙

### 11.1 개요
- `maxParticipants` = 1 → **SOLO** (기존 흐름: 생성 즉시 `IN_PROGRESS` + Agent dispatch)
- `maxParticipants` ≥ 2 → **GROUP**: `WAITING` → join → ready → 전원 ready 시 자동 start

### 11.2 REST API (추가)
| Method | Path | 설명 |
|--------|------|------|
| POST | `/v1/interviews/sessions` | body에 `maxParticipants` 추가 |
| POST | `/v1/interviews/sessions/{sessionId}/join` | body optional `{ resumeId }` |
| GET | `/v1/interviews/sessions/{sessionId}/lobby` | 대기실 상태 |
| PATCH | `/v1/interviews/sessions/{sessionId}/participants/me/ready` | 준비 완료 → 조건 충족 시 auto start |

### 11.3 LiveKit identity
- 면접자: `user-{memberId}` (기존과 동일, 참가자마다 별도 토큰)

### 11.4 Agent dispatch metadata (GROUP)
```json
{
  "mode": "GROUP",
  "sessionId": "sess-...",
  "jobRole": "BACKEND",
  "maxParticipants": 2,
  "participants": [
    { "memberId": 1, "identity": "user-1", "name": "...", "resumeText": "..." }
  ],
  "totalDurationSeconds": 900,
  "answerTimeLimitSeconds": 90
}
```

### 11.5 Room Data Messages (Agent 구현 필요)
- **START** (Backend → Room, auto start 시):
  `{ "type": "START", "payload": { "participants": [...], "currentSpeakerIndex": 0, "targetIdentity": "user-1" } }`
- **QUESTION** (Agent → Room):
  `{ "type": "QUESTION", "payload": { "turnNumber": 1, "text": "...", "targetIdentity": "user-1" } }`
- **NEXT** (Backend → Room): payload에 `targetIdentity` optional

### 11.6 Internal QnA
- `POST /internal/v1/interviews/sessions/{sessionId}/qnas` body에 `respondentMemberId` 추가

### 11.7 평가·피드백
- `POST /{sessionId}/evaluate` → GROUP 시 참가자별 `evaluateAllParticipants`
- `GET /feedback/{sessionId}` → 로그인 사용자 본인 participant 피드백만
- `interview_participants.total_feedback` / `overall_score` 에 저장

### 11.8 Agent 미구현 체크리스트
| 상태 | 작업 |
|------|------|
| ❌ | `START` 수신 후 첫 `QUESTION` (첫 화자 `targetIdentity`) |
| ❌ | 화자 순환: 다음 화자에게 `QUESTION` + `targetIdentity` |
| ❌ | 활성 화자 STT만 수집 (또는 한 명만 publish 정책과 정합) |
| ❌ | QnA upsert 시 `respondentMemberId` 포함 |
