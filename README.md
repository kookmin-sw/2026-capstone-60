# AI 모의면접 서버

자바 메인 서버와 HTTP 통신하는 AI 전용 FastAPI 서버입니다.
Bedrock Claude를 사용하여 면접 질문 생성, 꼬리질문, 피드백 리포트를 제공합니다.

## 프로젝트 구조

```
├── fastapi_server/
│   ├── main.py              # 더미 API (통신 테스트용)
│   ├── main_live.py         # 실제 Bedrock Claude 연동
│   ├── config.py            # 서버 설정
│   ├── prompts.py           # 프롬프트 템플릿
│   ├── session_store.py     # 세션 관리 (대화 기록)
│   └── llm_service.py       # Bedrock Claude 호출
├── requirements.txt
└── .env.example             # 환경 변수 템플릿
```

## 실행 방법

```bash
# 1. 의존성 설치
pip install -r requirements.txt

# 2. 환경 변수 설정
cp .env.example .env.local
# .env.local에 AWS_REGION 입력 (EC2 IAM Role 사용 시 키 불필요)

# 3. 더미 서버 (통신 테스트용)
python -m uvicorn fastapi_server.main:app --host 0.0.0.0 --port 8000

# 4. 실제 LLM 서버
python -m uvicorn fastapi_server.main_live:app --host 0.0.0.0 --port 8000
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/v1/interview/start` | 면접 시작 |
| POST | `/api/v1/interview/answer` | 답변 제출 및 꼬리질문 |
| GET | `/api/v1/interview/{session_id}/report` | 피드백 리포트 |
| GET | `/health` | 헬스체크 |

## EC2 배포 시 참고

- IAM Role에 `bedrock:InvokeModel`, `bedrock:Converse` 권한 필요
- Bedrock 콘솔에서 Claude 3.5 Sonnet 모델 접근 권한 활성화
- 보안 그룹에서 포트 8000 인바운드 허용
- `--host 0.0.0.0` 필수 (외부 접근 허용)
