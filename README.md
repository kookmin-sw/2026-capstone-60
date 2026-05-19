[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/Lvs6kcL8)

# 인터톡(Intertalk) - 실제 후기 기반 개발자 AI 모의 면접 시스템

## 1. 프로젝트 소개

지원자의 이력서와 자기소개서를 기반으로 맞춤형 기술 면접을 진행하는 AI 모의 면접 시스템입니다.

- RAG(검색 증강 생성) 기술을 활용하여 최신 면접 후기 데이터를 반영한 동적 질문 생성
- 사용자의 음성 답변을 실시간으로 분석하여 꼬리 질문 제공
- LLM 기반의 세부 카테고리별(정확성, 논리성, 깊이, 전달력) 피드백 제공
- LiveKit 기반 실시간 음성 면접 환경 (질문당 1분 30초, 총 15분 제한)

### 주요 기능

| 기능 | 설명 |
|------|------|
| 이력서 PDF 파싱 | Apache PDFBox로 PDF → 텍스트 자동 추출 후 DB 저장 |
| RAG 기반 질문 생성 | Velog 크롤링 → S3 → Knowledge Base 인덱싱 → 질문 생성 시 참고 |
| 실시간 음성 면접 | LiveKit STT/TTS로 음성 질문-답변 교환 |
| AI 꼬리질문 | 답변 분석 후 부족한 점(focus_point) 기반 심화 질문 생성 |
| AI 피드백 리포트 | 면접 종료 후 질문별 상세 평가 및 모범 답안 제공 |

### 기술 스택

- **Backend**: Java 17, Spring Boot 4.x, Spring Security, Spring Data JPA
- **AI Agent**: Python, LiveKit Agent, AWS Bedrock (Claude 3.5 Sonnet)
- **Frontend**: React, JavaScript, Vite
- **Database**: PostgreSQL + pgvector
- **Infra**: AWS EC2, S3, Bedrock Knowledge Base, GitHub Actions, Vercel
- **음성**: LiveKit Cloud (WebRTC, STT/TTS)

## 2. 소개 영상

(추후 추가 예정)

## 3. 팀 소개

**AWS 캡스톤디자인 60팀**

| 이름 | 학번 | 담당 |
|-------|------|------|
| 김준범 | 20203048 | 면접 시작~종료 흐름, DB 설계 |
| 정은미 | 20220792 | LLM 평가 + 피드백, 디자인|
| 최현택 | 20203154 | 프론트엔드, 인프라/배포, 마이페이지, CI/CD |
| 함태원 | 20213095 | AI 질문 생성, RAG 파이프라인, 크롤링 |

## 4. 사용법

### 사전 준비
- JDK 17
- Docker Desktop (PostgreSQL용)
- Node.js 18+ (프론트엔드)

### Backend 실행
```bash
cd backend
cp .env.example .env
# .env에 JWT_SECRET, LIVEKIT_*, DB_* 설정

docker compose up -d    # PostgreSQL 실행
./gradlew bootRun       # Spring Boot 서버 실행 (localhost:8080)
```

### Frontend 실행
```bash
cd frontend
npm install
npm run dev             # 개발 서버 실행 (localhost:5173)
```

### RAG 크롤링 파이프라인 (선택)
```bash
cd interview-agent
pip install -r requirements.txt
python -m pipeline.run_crawl --sync --kb-id MVJMHC0YM2 --data-source-id RDWXCFKHMW
```

### 배포 환경
- **Backend**: AWS EC2 + GitHub Actions 자동 배포
- **Frontend**: Vercel 자동 배포
- **AI Agent**: LiveKit Cloud에서 자동 실행

## 5. 시스템 아키텍처

```
[Frontend (React/Vercel)]
   │  REST API (JWT 인증)
   ▼
[Backend (Spring Boot / EC2)]
   ├── 회원 인증, 이력서 파싱, 세션 관리
   ├── Agent Dispatch (metadata에 이력서 텍스트 포함)
   └── AI 평가/피드백 생성 (Bedrock 호출)
         │
         ▼
[LiveKit Cloud] ◀──WebRTC──▶ [Frontend]
         │
         ▼
[LiveKit Agent (Python)]
   ├── STT (음성 → 텍스트)
   ├── 답변 판단 (충족/미충족)
   ├── KB 검색 (Bedrock Knowledge Base)
   ├── 질문 생성 (Bedrock Claude)
   └── TTS (텍스트 → 음성)

[크롤링 파이프라인]
   Velog 크롤링 → S3 업로드 → Knowledge Base 자동 인덱싱
```

## 6. 프로젝트 구조

```
├── backend/              # Spring Boot 메인 서버
├── frontend/             # React 프론트엔드
├── livekit-agent/      # LiveKit Agent + RAG 파이프라인
│   ├── agent.py          # LiveKit Agent 메인
│   ├── ai/              # LLM 서비스, 프롬프트, 세션 관리
│   └── pipeline/        # 크롤링 + S3 업로드
└── README.md
```

## 7. 관련 링크

- [Backend Repository](https://github.com/capstone-ai-mock-interview/backend)
- [Frontend Repository](https://github.com/capstone-ai-mock-interview/frontend)
- [RAG/Agent Repository](https://github.com/capstone-ai-mock-interview/RAG)
