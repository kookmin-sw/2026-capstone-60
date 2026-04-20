# AI Interview Frontend

실시간 AI 면접 프론트엔드 예시 구현입니다.

## 실행

```bash
npm install
npm run dev
```

## 환경 변수

`.env` 파일을 만들고 아래 값을 설정하세요.

```bash
VITE_API_BASE_URL=https://api.yourdomain.com/v1/interviews
VITE_AUTH_BASE_URL=https://api.yourdomain.com/v1/auth
VITE_AUTH_TOKEN=
VITE_USE_MOCK=false
```

## JWT 로그인 동작

1. 로그인 화면에서 `POST /v1/auth/login` 호출
2. 응답의 `accessToken`, `refreshToken`, `user`를 `localStorage`에 저장
3. 앱 재접속/새로고침 시 `GET /v1/auth/me`로 세션 유효성 확인
4. 이후 인터뷰 API 호출에 `Authorization: Bearer <accessToken>` 자동 첨부
5. 로그아웃 시 저장된 인증 정보 삭제

저장 키:

- `accessToken`
- `refreshToken`
- `authUser`

## 문서 업로드 및 면접 시작 사전절차

- 준비 화면에서 이력서/자소서 파일을 업로드할 수 있습니다. (브라우저 로컬 저장)
- 면접 시작 시 문서 ID가 아닌 업로드한 **문서 이름**으로 이력서/자소서를 선택합니다.
- 이력서/자소서 선택은 필수가 아니며, 둘 다 선택하지 않아도 면접을 시작할 수 있습니다.
- `마이크 테스트 시작`으로 실제 오디오 권한/입력 감지를 확인한 뒤 `테스트 종료`를 눌러 통과 상태를 반영합니다.
- 마이크 테스트 통과 체크 + 90초 규칙 체크가 완료되어야 시작 버튼이 활성화됩니다.

## 누적 면접 기록 메뉴

- 상단 메뉴의 `면접 기록`에서 로그인 사용자 기준 누적 기록 목록을 조회합니다.
- 목록에서 `상세 보기`를 누르면 질문/답변/모범답안까지 포함한 상세를 볼 수 있습니다.
- 평가 완료 시 프론트는 결과를 `POST /v1/interviews/results`로 저장 요청합니다.
- 백엔드는 반드시 **로그인 사용자 본인 기록만** 목록/상세에 노출해야 합니다.

## "면접 시작" 클릭 시 동작 순서

1. `SessionSetupForm`에서 `resumeIds`, `coverLetter`, `jobField`, `durationMinutes`를 수집합니다.
2. `App.startSession()`이 실행되어 로딩 상태(`loading=true`)로 전환합니다.
3. `createInterviewSession()` 호출:
   - 실서버 모드: `POST /sessions`
   - mock 모드: 내부 mock 세션 생성
4. 응답에서 `sessionId`와 `livekit` 정보를 저장합니다.
5. 화면 상태가 `READY -> INTERVIEW`로 바뀝니다.
6. `InterviewRoom` 진입 후:
   - 실서버 모드: LiveKit `room.connect()` 실행 후 마이크 활성화
   - mock 모드: 즉시 연결된 상태로 표시
7. 면접 타이머(전체 시간)와 답변 타이머(90초)가 시작됩니다.

## 프론트 단독 테스트(mock 모드)

백엔드/Spring Boot 없이 UI 흐름 전체를 검증하려면:

```bash
# .env
VITE_USE_MOCK=true
```

mock 로그인 계정:

- email: `demo@interview.ai`
- password: `demo1234`

그 뒤 실행:

```bash
npm run dev
```

앱 상단에 `Mock Mode: 백엔드 없이 단독 테스트 중` 배지가 보이면 정상입니다.

## 테스트 케이스

### 수동 테스트 케이스

- TC-01 세션 생성: 시작 버튼 클릭 시 면접 화면으로 전환되고 세션/룸 정보가 표시된다.
- TC-01-REQ: 시작 시 요청 바디가 `{ resumeIds: number, coverLetter: number, jobField, durationMinutes }` 형식이다.
- TC-02 마이크 토글: "마이크 끄기/켜기" 버튼 클릭 시 버튼 텍스트가 상태에 맞게 바뀐다.
- TC-03 종료 플로우: "면접 종료" 클릭 시 평가중 화면으로 전환된다.
- TC-04 결과 폴링: 잠시 후 결과 화면으로 전환되고 점수/문답 목록이 표시된다.
- TC-05 재시작: "새 면접 시작" 클릭 시 초기 입력 화면으로 복귀한다.

### 자동 테스트 케이스(vitest)

```bash
npm run test
```

포함된 자동 테스트:

- JWT 로그인 성공/실패 및 사용자 조회(mock) 확인
- mock 모드 활성화 여부 확인
- 세션 생성 -> 종료 -> 결과 폴링 재시도 후 성공 응답 확인

## 구현 범위

- `POST /sessions`로 면접 세션 생성
- LiveKit 접속 및 마이크 on/off 제어
- 전체 면접 시간 카운트다운 + 90초 답변 타이머
- `POST /sessions/{sessionId}/end`로 수동/자동 종료
- `GET /sessions/{sessionId}/result` 폴링으로 결과 조회

## 백엔드 연동 통합 문서

- `docs/backend-integration-spec.md`
