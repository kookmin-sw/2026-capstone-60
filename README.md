# livekit-agent

AI 모의면접 시스템의 **LiveKit Agent (Worker)**.
Room 에 접속해 사용자와 음성으로 대화하며, LLM 호출(질문 생성 / 꼬리질문 / RAG) 을
**같은 프로세스 안에서** 직접 수행한다.

## 역할

| 할 일 | 안 할 일 |
|-------|----------|
| LiveKit Room 참여 | HTTP 서버 노출 |
| STT / TTS / 턴 감지 (LiveKit Inference) | DB 저장 (Spring 담당) |
| 면접 질문 / 꼬리질문 생성 (Bedrock Claude) | 회원/이력서 업로드 |
| RAG retrieve (Bedrock Knowledge Base) | 크롤링 (`rag/pipeline/` 담당) |

## 구조

```
livekit-agent/
├── agent.py                # Worker 진입점, InterviewerAgent
├── ai/
│   ├── config.py           # 환경 변수 로드
│   ├── llm_service.py      # Bedrock Converse + KB Retrieve
│   ├── prompts.py          # 프롬프트 템플릿 (동료 관리)
│   └── session.py          # InterviewSession dataclass
├── DISPATCH_CONTRACT.md    # Spring ↔ Agent metadata 스펙
├── requirements.txt
└── .env.example
```

## 시스템 흐름

```
사용자(브라우저) ─WebRTC─▶ LiveKit Cloud ─dispatch─▶ Agent(Worker)
                                                         │
                                                         │ (in-process)
                                                         ▼
                                                   Bedrock Converse
                                                   Bedrock KB Retrieve
```

## 조합

- **STT**: LiveKit Inference (Deepgram Nova-3, multi language)
- **LLM**: Bedrock 직접 호출 (boto3)
- **TTS**: LiveKit Inference (Cartesia Sonic-3)

LLM 을 Bedrock 으로 직접 쓰는 이유: Bedrock Knowledge Base 의 RAG retrieve 가 필요하기 때문.
이미 AWS 자격증명을 쓰는데 LLM 만 다른 경로로 보낼 이유가 없음.

## 설치

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

## 실행 모드

```bash
# 1) 콘솔 모드 — 브라우저/LiveKit Room 없이 터미널에서 음성 대화
python agent.py console

# 2) dev 모드 — LiveKit Cloud 에 dev 워커로 접속
python agent.py dev

# 3) 프로덕션
python agent.py start
```

## 로컬 개발 팁

- **KB 없이 개발**: `.env` 의 `KNOWLEDGE_BASE_ID` 를 비우면 retrieve 를 skip.
- **Spring dispatch 없이 테스트**: `DEV_METADATA` 환경변수로 metadata 주입.
  ```bash
  export DEV_METADATA='{"sessionId":"test-1","jobRole":"BACKEND","resumeText":"..."}'
  python agent.py console
  ```
- metadata 가 없으면 내장 기본값(랜덤 sessionId, 샘플 이력서) 으로 폴백.

## 메타데이터 계약

Spring → Agent 로 전달되는 JSON 스키마는 [DISPATCH_CONTRACT.md](./DISPATCH_CONTRACT.md) 참고.

## 프롬프트 관리

`ai/prompts.py` 는 동료 관리 영역. 최신본을 받으면 파일을 통째로 덮어쓰면 된다.
(현재는 `rag/fastapi_server/prompts.py` 의 스냅샷)

## 크롤링 파이프라인

`rag/pipeline/` 에 별도 존재. Agent 와 무관하게 cron / 수동 실행으로 돌린다.
