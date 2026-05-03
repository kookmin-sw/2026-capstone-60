# AI 모의면접 질문 생성 서버

자바 메인 서버 및 LiveKit Agent와 HTTP 통신하는 AI 전용 FastAPI 서버입니다.
AWS Bedrock Claude + Knowledge Base(RAG)를 사용하여 이력서 기반 면접 질문, 꼬리질문, 다음 주제 질문을 생성합니다.

## 이 서버가 하는 일

1. **첫 질문 생성** — 이력서와 직무 정보를 받아 KB에서 관련 면접 자료를 검색하고, Claude가 현실적인 첫 면접 질문을 생성합니다.
2. **꼬리질문 생성** — 지원자의 답변을 받아 KB에서 심화 자료를 검색하고, Claude가 답변의 허점을 파고드는 꼬리질문을 생성합니다.
3. **다음 주제 질문 생성** — 이전 대화에서 이미 다룬 내용을 자동으로 파악하여, 중복 없이 새로운 주제의 질문을 생성합니다.
4. **출제 의도 제공** — 모든 질문에 "왜 이 질문을 했는지"(intent)를 함께 반환합니다.

꼬리질문을 할지 말지 판단하는 것은 이 서버의 역할이 아닙니다. 외부(다른 AI 모듈)에서 판단한 뒤, 꼬리질문이 필요하면 `/answer`를, 다음 주제로 넘어가면 `/next-question`을 호출합니다.

## 프로젝트 구조

```
├── fastapi_server/
│   ├── main.py            # FastAPI 앱, 엔드포인트 정의
│   ├── config.py          # 환경 변수 로드 (AWS 리전, 모델, KB ID)
│   ├── prompts.py         # 면접관 시스템 프롬프트, 질문 생성 프롬프트 템플릿
│   ├── session_store.py   # 세션별 대화 기록 관리 (메모리 기반)
│   └── llm_service.py     # KB 검색(Retrieve) + Bedrock Claude 호출
├── pipeline/
│   ├── crawler.py         # Velog 백엔드 면접 자료 크롤링
│   ├── s3_uploader.py     # 크롤링 결과를 S3에 .txt로 업로드
│   └── run_crawl.py       # 크롤링 파이프라인 실행 스크립트
├── requirements.txt
├── .env.example           # 환경 변수 템플릿 (실제 값 포함)
└── README.md
```

## 동작 흐름

```
[크롤링 파이프라인 - 1회성 또는 주기적 실행]
Velog에서 백엔드 면접 자료 크롤링
    → S3 버킷에 .txt 업로드
    → Knowledge Base가 자동으로 청크 분할 + 임베딩 + 인덱싱

[면접 서버 - 실시간]

자바 서버 → POST /start (이력서 + 직무)
              → KB 검색 → Claude 첫 질문 생성
              ← {session_id, initial_question, intent}

LiveKit Agent → POST /answer (session_id + 답변)
                 → KB 검색 → Claude 꼬리질문 생성
                 ← {follow_up_question, intent}

LiveKit Agent → POST /next-question (session_id + 마지막 답변)
                 → 이미 다룬 주제 파악 → KB 검색 → Claude 새 주제 질문 생성
                 ← {question, intent}
```

## LiveKit Agent 연동 흐름

```
[면접 시작]
자바 서버 → /start → 첫 질문 텍스트 → LiveKit Agent → TTS → 사용자에게 음성 송출

[면접 진행 - 반복]
사용자 음성 답변 → LiveKit Agent STT → 텍스트 변환
    → 판단 AI가 결정:
        ├── 꼬리질문 필요 → /answer 호출 → 꼬리질문 텍스트
        └── 다음 주제로   → /next-question 호출 → 새 주제 질문 텍스트
    → LiveKit Agent TTS → 사용자에게 음성 송출
```

## API 엔드포인트

### POST `/api/v1/interview/start`

면접을 시작합니다. 이력서를 분석하여 첫 질문을 생성합니다.

**요청:**
```json
{
  "job_role": "백엔드 개발자",
  "resume_text": "이력서 텍스트 전체"
}
```

**응답:**
```json
{
  "session_id": "uuid-string",
  "initial_question": "이력서에 Redis 분산 락을 사용하셨다고 했는데, 왜 Redis를 선택하셨나요?",
  "intent": "기술 선택 이유와 대안 기술 비교 능력 확인"
}
```

### POST `/api/v1/interview/answer`

답변을 받아 꼬리질문을 생성합니다. 꼬리질문이 필요하다고 판단된 경우에만 호출합니다.

**요청:**
```json
{
  "session_id": "uuid-string",
  "user_answer": "지원자의 답변 텍스트"
}
```

**응답:**
```json
{
  "follow_up_question": "분산 락의 TTL을 어떻게 설정하셨나요? 데드락 상황은 어떻게 처리하셨나요?",
  "intent": "분산 락 운영 경험과 예외 처리 능력 확인"
}
```

### POST `/api/v1/interview/next-question`

다음 주제로 넘어갈 때 호출합니다. 이전에 다룬 내용을 자동으로 피하고 새로운 주제로 질문합니다.

**요청:**
```json
{
  "session_id": "uuid-string",
  "user_answer": "마지막 답변 텍스트 (선택, 빈 문자열 가능)"
}
```

**응답:**
```json
{
  "question": "Docker를 사용하셨다고 했는데, 컨테이너 오케스트레이션은 어떻게 하셨나요?",
  "intent": "배포 및 인프라 운영 경험 확인"
}
```

### GET `/health`

서버 상태 확인용.

## 각 파일 상세 설명

### `config.py`
`.env.local`에서 환경 변수를 읽어옵니다:
- `AWS_REGION` — Bedrock과 KB가 있는 AWS 리전
- `LLM_MODEL` — 사용할 Claude 모델 ID
- `KNOWLEDGE_BASE_ID` — KB에서 자료를 검색할 때 사용하는 ID

### `prompts.py`
Claude에게 보내는 프롬프트 템플릿:
- `INTERVIEWER_SYSTEM_PROMPT` — 면접관 페르소나 + 이력서/직무 정보
- `FIRST_QUESTION_PROMPT` — 첫 질문 생성 지시 + KB 참고 자료
- `FOLLOW_UP_PROMPT` — 꼬리질문 생성 지시 + KB 참고 자료
- `NEXT_QUESTION_PROMPT` — 새 주제 질문 생성 지시 + 이미 다룬 주제 목록 + KB 참고 자료

### `session_store.py`
`session_id` 기준으로 대화 기록을 메모리에 저장합니다:
- 질문, 답변, 출제 의도를 턴 단위로 기록
- `/next-question`에서 이미 다룬 주제를 파악하는 데 사용
- 꼬리질문 생성 시 이전 대화 이력을 Claude에게 함께 전달하여 맥락 유지

### `llm_service.py`
실제 AI 호출을 담당합니다:
1. `_retrieve_from_kb()` — Knowledge Base Retrieve API로 관련 자료 검색
2. `generate_first_question()` — KB 검색 + Claude 호출 → 첫 질문 생성
3. `generate_follow_up()` — KB 검색 + Claude 호출 → 꼬리질문 생성
4. `generate_next_topic()` — 이미 다룬 주제 파악 + KB 검색 + Claude 호출 → 새 주제 질문 생성

### `pipeline/crawler.py`
Velog GraphQL API로 백엔드 면접 관련 글을 크롤링합니다.
10개 키워드(Spring 면접, Java 면접, Redis 면접 등)를 순회하며 수집합니다.

### `pipeline/s3_uploader.py`
크롤링한 글을 `.txt` 파일로 S3에 업로드합니다.
파일 상단에 메타데이터(제목, 출처, 주제)를 포함시켜 KB가 맥락을 유지하도록 합니다.

## 실행 방법

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 환경 변수 설정
```bash
cp .env.example .env.local
# EC2 IAM Role 사용 시 AWS 키는 주석 처리된 상태로 두면 됨
```

### 3. 서버 실행
```bash
python -m uvicorn fastapi_server.main:app --host 0.0.0.0 --port 8000 --root-path /proxy/8000
```

### 4. 크롤링 파이프라인 실행 (KB 데이터 축적)
```bash
# 크롤링 + S3 업로드
python -m pipeline.run_crawl

# 크롤링 + S3 업로드 + KB 동기화
python -m pipeline.run_crawl --sync --kb-id MVJMHC0YM2 --data-source-id RDWXCFKHMW
```

## EC2 배포 시 필요한 권한

EC2 IAM Role에 다음 권한이 필요합니다:
- `bedrock:Converse` — Claude 대화 API
- `bedrock:Retrieve` — Knowledge Base 검색
- `s3:PutObject` — 크롤링 데이터 업로드 (파이프라인 실행 시)
- `bedrock:StartIngestionJob` — KB 동기화 (--sync 옵션 사용 시)

## 기술 스택

- **서버**: FastAPI + Uvicorn
- **LLM**: AWS Bedrock Claude 3.5 Sonnet
- **RAG**: AWS Bedrock Knowledge Base (Retrieve API)
- **데이터 저장**: Amazon S3
- **크롤링**: Velog GraphQL API + requests
