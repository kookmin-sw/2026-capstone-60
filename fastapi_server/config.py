"""
FastAPI 서버 설정.
환경 변수에서 AWS 자격 증명과 Bedrock 모델 설정을 로드한다.
"""

import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"))

# AWS
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Bedrock LLM 모델
LLM_MODEL = os.getenv("LLM_MODEL", "anthropic.claude-3-5-sonnet-20241022-v2:0")

# 면접 설정
MAX_QUESTIONS = 5          # 총 질문 수
MAX_FOLLOW_UPS = 2         # 주제당 최대 꼬리질문 수
