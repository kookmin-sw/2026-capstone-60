# 그룹 면접 — leave / end / feedback 연동 (백엔드·Agent 전달용)

> 프론트 조치 일자: 2026-05-20  
> 프론트 변경: HOST「면접 종료」/ GUEST「나가기」 분리, 게스트 피드백 폴링, 나가기 안내

---

## 프론트에서 이미 적용한 조치

| 항목 | 내용 |
|------|------|
| HOST 버튼 | 그룹에서 **「면접 종료」** → `POST .../end` → `POST .../evaluate` → 평가 화면 |
| GUEST 버튼 | **「나가기」** → `POST .../participants/me/leave` → 홈 + 기록 안내 |
| GUEST 대기 | 방에 남아 있으면 8초마다 `GET .../feedback/{sessionId}` 폴링 → 준비 시 결과 화면 |
| GUEST next | 「다음 질문」 버튼 숨김 (호스트만 next API) |

---

## 백엔드 팀 — 확인·구현 요청

### 1. `POST /v1/interviews/sessions/{sessionId}/participants/me/leave`

프론트가 호출 중. INTEGRATION_CONTRACT §11.2에는 미기재.

**확인 요청:**
- API 존재 여부, 스키마, HOST 호출 시 403 여부
- leave 후 participant 상태, LiveKit identity 처리
- leave 한 게스트가 `evaluateAllParticipants` / `GET feedback/{sessionId}` 대상에 포함되는지
- leave 한 게스트의 `feedbackList` 노출 여부

**기대:**
- GUEST leave = 퇴장만, 세션은 HOST가 `end` 할 때까지 IN_PROGRESS 가능
- evaluate 후 GUEST도 `GET /feedback/{sessionId}` 로 **본인** 피드백 조회 가능

### 2. `POST /v1/interviews/sessions/{sessionId}/end` (GROUP, HOST only)

**확인 요청:**
- GUEST 호출 시 403
- 성공 시 상태 `COMPLETED`, Room END + cleanup
- 다른 참가자가 피드백 준비됐는지 알 수 있는 방법 (폴링 `GET feedback/{sessionId}` 만으로 충분한지)

### 3. `POST /v1/interviews/{sessionId}/evaluate`

**확인 요청:**
- HOST만 호출 가능한지
- 참가자별 `interview_participants.total_feedback` 저장
- QnA 없는 참가자 / leave 한 참가자 처리

### 4. `GET /v1/interviews/feedback/{sessionId}`

**확인 요청:**
- 평가 전: `{ "success": false, "totalFeedback": "..." }` 형식 유지
- 평가 후: `success: true` + `qaPairs`, `overallScore`, `competencyChart`
- GROUP GUEST: 본인 participant 기준만 반환

### 5. `GET /v1/interviews/feedbackList`

**확인 요청:**
- GROUP 세션도 목록에 포함
- 필드: `sessionId`, `category` 또는 `jobField`, `overallScore`, `createdAt`

### 테스트 시나리오 (백엔드)

```bash
# 전제: JWT_TOKEN, SESSION_ID, HOST/GUEST 각각 로그인

# 1) HOST end + evaluate
curl -X POST "$BASE/v1/interviews/sessions/$SESSION_ID/end" \
  -H "Authorization: Bearer $HOST_TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"USER_STOP"}'

curl -X POST "$BASE/v1/interviews/$SESSION_ID/evaluate" \
  -H "Authorization: Bearer $HOST_TOKEN"

# 2) GUEST feedback (평가 완료 후)
curl "$BASE/v1/interviews/feedback/$SESSION_ID" \
  -H "Authorization: Bearer $GUEST_TOKEN"

# 3) GUEST leave (진행 중)
curl -X POST "$BASE/v1/interviews/sessions/$SESSION_ID/participants/me/leave" \
  -H "Authorization: Bearer $GUEST_TOKEN"
```

---

## LiveKit Agent 팀 — 확인·구현 요청

### 1. HOST `end` → Room `END` Data

- END 수신 시 STT flush + Internal QnA upsert (`respondentMemberId`)
- Room 정리 후 Worker 종료

### 2. GUEST disconnect / leave

- 1명 퇴장 시 나머지 면접 계속 여부
- `targetIdentity`가 leave 한 `user-{memberId}` 일 때 스킵 규칙
- partial QnA 저장

### 3. GROUP 필수 (§11.5)

- `START` → 첫 `QUESTION` + `targetIdentity`
- 화자 순환, 비활성 참가자 STT 미수집
- QnA upsert에 `respondentMemberId`

### 4. 평가

- evaluate는 Backend 전담인지 Agent 추가 작업 여부

### 테스트 시나리오 (Agent)

1. 2인 GROUP, 각 1턴 답변 → HOST end → HOST/GUEST feedback API에 QnA 반영 여부
2. GUEST leave 후 HOST end → GUEST feedback 생성 여부
3. HOST가 leave API만 호출(오류 케이스) → Agent/Room 상태

---

## 프론트 통합 테스트 체크리스트

| # | 시나리오 | 기대 |
|---|----------|------|
| 1 | HOST 그룹 면접 → 「면접 종료」 | 평가 중 → 결과 → 기록 목록 |
| 2 | GUEST 그룹 면접 → 「나가기」 | 확인 모달 → 홈 안내 → (호스트 종료 후) 기록에 본인 항목 |
| 3 | GUEST 방 유지, HOST 종료 | 8초 내 결과 화면 자동 전환 (evaluate 완료 시) |
| 4 | SOLO 「면접 종료」 | 기존과 동일 |
| 5 | Network: HOST end/evaluate | `/v1/...` 프록시 200/401, Mixed Content 없음 |

---

## curl 스모크 (프로덕션 프록시)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://capstonefront.vercel.app/v1/auth/login \
  -X POST -H "Content-Type: application/json" -d '{"loginId":"test","password":"test"}'
```

백엔드 직접:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://23.22.137.145:8080/v1/auth/login \
  -X POST -H "Content-Type: application/json" -d '{"loginId":"test","password":"test"}'
```
