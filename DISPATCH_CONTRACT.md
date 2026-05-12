# Dispatch Contract

LiveKit Agent는 Spring 백엔드가 dispatch 요청 시 넘겨주는 **job metadata**를 통해
면접 컨텍스트를 받습니다. Agent는 이 값을 해석·변형하지 않고 RAG 서버 호출 시 그대로 전달합니다.

## Metadata JSON 스키마

```json
{
  "sessionId": "sess-a1b2c3d4",
  "jobRole": "BACKEND",
  "resumeText": "이력서 원문 전체..."
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `sessionId` | string | O | 시스템 전체에서 공유되는 면접 식별자. Spring이 생성. |
| `jobRole` | string | O | 면접 직무 분야 (예: `BACKEND`, `FRONTEND`) |
| `resumeText` | string | O | 이력서 원문 텍스트 |

## Spring dispatch 호출 예시 (Java / LiveKit Server SDK)

```java
AgentDispatchRequest.newBuilder()
    .setRoom(roomName)
    .setAgentName("interviewer-agent")
    .setMetadata(objectMapper.writeValueAsString(Map.of(
        "sessionId", sessionId,
        "jobRole", jobField,
        "resumeText", resumeText
    )))
    .build();
```

## 개발 모드 fallback

Agent는 아래 우선순위로 metadata를 읽습니다.

1. `ctx.job.metadata` (프로덕션 경로)
2. `DEV_METADATA` 환경변수 (`console`/`dev` 모드 로컬 테스트용)
3. 내장 기본값 (임의 `sessionId` 생성, `jobRole=BACKEND`, 샘플 이력서)

로컬에서 Spring dispatch 없이 돌릴 때:

```bash
export DEV_METADATA='{"sessionId":"test-1","jobRole":"BACKEND","resumeText":"..."}'
python agent.py console
```

## 변경 이력

- 2026-05-08: 초기 스펙 제안 (Agent 담당)


## 관련 문서

- 전체 통합 스펙(API, Data Message, 타이머, QnA 저장 포함): 워크스페이스 루트의
  [`INTEGRATION_CONTRACT.md`](../INTEGRATION_CONTRACT.md)
