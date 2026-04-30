# AI 모의면접 서버

자바 메인 서버와 HTTP 통신하는 AI 전용 FastAPI 서버입니다.
Bedrock Claude + Knowledge Base(RAG)를 사용하여 면접 질문 생성, 꼬리질문, 피드백 리포트를 제공합니다.

## 프로젝트 구조

```
├── fastapi_server/          # FastAPI 서버
│   ├── main.py              # 더미 API (통신 테스트용)
│   ├── main_live.py         # 실제 Bedrock Claude 연동
│   ├── config.py            # 서버 설정 (AWS, KB, 모델)
│   ├── prompts.py           # 프롬프트 템플릿
│   ├── session_store.py     # 세션 관리 (대화 기록)
│   └── llm_service.py       # Bedrock Claude + KB 검색 호출
├── pipeline/                # 크롤링 파이프라인
│   ├── crawler.py           # Velog 백엔드 면접 자료 크롤링
│   ├── s3_uploader.py       # S3 업로드 + KB 동기화
│   └── run_crawl.py         # 파이프라인 실행 스크립트
├── requirements.txt
├── .env.example             # 환경 변수 템플릿
└── README.md
```

## 아키텍처

```
[크롤링 파이프라인]
Velog 크롤링 → S3 업로드(.txt) → Knowledge Base 자동 인덱싱

[면접 서버]
자바 서버 → FastAPI → KB에서 관련 자료 검색(Retrieve)
                    → Claude에게 이력서 + KB 자료 + 대화 이력 전달
                    → 질문/꼬리질문/리포트 생성
```

## 실행 방법

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. 환경 변수 설정
```bash
cp .env.example .env.local
# .env.local에 아래 항목 입력:
# - AWS_REGION
# - S3_BUCKET_NAME, S3_PREFIX
# - KNOWLEDGE_BASE_ID
# EC2 IAM Role 사용 시 AWS 키는 불필요
```

### 3. 서버 실행
```bash
# 더미 서버 (통신 테스트용, AWS 불필요)
python -m uvicorn fastapi_server.main:app --host 0.0.0.0 --port 8000

# 실제 LLM 서버 (Bedrock + Knowledge Base)
python -m uvicorn fastapi_server.main_live:app --host 0.0.0.0 --port 8000 --root-path /proxy/8000
```

### 4. 크롤링 파이프라인 실행
```bash
# 백엔드 면접 자료 크롤링 → S3 업로드
python -m pipeline.run_crawl

# 크롤링 + Knowledge Base 동기화까지
python -m pipeline.run_crawl --sync --kb-id <KB_ID> --data-source-id <DS_ID>
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/interview/start` | 면접 시작 (이력서 입력 → 첫 질문 + 출제 의도) |
| POST | `/api/v1/interview/answer` | 답변 제출 → 꼬리질문/다음 질문 + 출제 의도 |
| GET | `/api/v1/interview/{session_id}/report` | 피드백 리포트 |
| GET | `/health` | 헬스체크 |

## 응답 예시

`/start` 응답:
```json
{
  "session_id": "uuid",
  "initial_question": "Redis 분산 락을 선택하신 이유가 무엇인가요?",
  "intent": "기술 선택 이유와 대안 기술 비교 능력 확인"
}
```

`/answer` 응답:
```json
{
  "next_question": "분산 락 외에 다른 동시성 제어 방법은 고려해보셨나요?",
  "is_tail_question": true,
  "interview_status": "IN_PROGRESS",
  "intent": "대안 기술에 대한 이해도 평가"
}
```

## EC2 배포 시 참고

- IAM Role에 `bedrock:InvokeModel`, `bedrock:Converse`, `bedrock:Retrieve` 권한 필요
- Bedrock 콘솔에서 Claude 3.5 Sonnet 모델 접근 권한 활성화
- Knowledge Base 생성 후 S3 버킷을 데이터 소스로 연결
- 보안 그룹에서 포트 8000 인바운드 허용
- `--host 0.0.0.0` 필수 (외부 접근 허용)
