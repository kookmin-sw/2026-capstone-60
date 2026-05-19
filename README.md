# 인터톡(Intertalk) - 실제 후기 기반 개발자 AI 모의 면접 시스템

## 1. 프로젝트 소개

지원자의 이력서와 자기소개서를 기반으로 맞춤형 기술 면접을 진행하는 AI 모의 면접 시스템입니다.

- 실제 기술 면접 후기 데이터를 참고한 개인화 질문 생성
- 사용자의 음성 답변을 바탕으로 이어지는 꼬리질문
- 질문별 피드백과 모범 답안 제공
- 1:1 면접과 그룹 면접 흐름 지원

### 주요 기능

| 기능 | 설명 |
| --- | --- |
| 이력서/자소서 기반 질문 | 사용자의 프로젝트 경험과 기술 스택을 바탕으로 면접 질문 구성 |
| 실제 후기 기반 질문 보강 | 크롤링한 기술 면접 후기 데이터를 Knowledge Base로 활용 |
| 실시간 음성 면접 | LiveKit 기반 음성 질문-답변 환경 제공 |
| 꼬리질문 | 답변이 부족한 부분을 중심으로 추가 질문 생성 |
| 피드백 리포트 | 면접 종료 후 질문별 평가, 모범 답안, 개선 방향 제공 |
| 그룹 면접 | 대기실, Ready 상태, 참여자별 피드백 흐름 지원 |

### 기술 스택

- **Backend**: Java 17, Spring Boot, Spring Security, Spring Data JPA
- **AI Agent**: Python, LiveKit Agent, AWS Bedrock
- **Frontend**: React, Vite, Tailwind CSS
- **Database**: PostgreSQL, pgvector
- **Infra**: AWS EC2, S3, Bedrock Knowledge Base, GitHub Actions
- **Realtime**: LiveKit, WebRTC, STT/TTS

## 2. 소개 영상

추후 추가 예정

## 3. 팀 소개

**AWS 캡스톤디자인 60팀**

| 이름 | 학번 | 담당 |
| --- | --- | --- |
| 김준범 | 20203048 | 면접 시작~종료 흐름, DB 설계 |
| 정은미 | 20220792 | LLM 평가 + 피드백, 디자인 |
| 최현택 | 20203154 | 프론트엔드, 인프라/배포, 마이페이지, CI/CD |
| 함태원 | 20213095 | AI 질문 생성, RAG 파이프라인, 크롤링 |

## 4. 사용법

### 사전 준비

- JDK 17
- Docker Desktop
- Node.js 18+

### Backend 실행

```bash
cd backend
cp .env.example .env
docker compose up -d
./gradlew bootRun
```

### Frontend 실행

```bash
cd frontend
npm install
npm run dev
```

### RAG / LiveKit Agent 실행

```bash
cd livekit-agent
pip install -r requirements.txt
python agent.py
```

## 5. 시스템 아키텍처

```text
[Frontend]
   │ REST API / LiveKit
   ▼
[Backend]
   ├── 회원 인증
   ├── 이력서/자소서 관리
   ├── 면접 세션 관리
   └── 평가/피드백 저장
         │
         ▼
[LiveKit Cloud]
         │
         ▼
[LiveKit Agent]
   ├── STT
   ├── 답변 분석
   ├── Knowledge Base 검색
   ├── 질문 생성
   └── TTS
```

## 6. 프로젝트 구조

```text
├── backend/          # Spring Boot 서버
├── frontend/         # React 서비스 프론트엔드
├── livekit-agent/    # LiveKit Agent + RAG 파이프라인
├── src/              # GitHub Pages 소개 페이지
├── public/           # 소개 페이지 정적 에셋
└── README.md
```

## 7. 관련 링크

- [Backend Repository](https://github.com/capstone-ai-mock-interview/backend)
- [Frontend Repository](https://github.com/capstone-ai-mock-interview/frontend)
- [RAG/Agent Repository](https://github.com/capstone-ai-mock-interview/RAG)
