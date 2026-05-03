"""
FastAPI 서버 설정.
환경 변수에서 AWS 자격 증명과 모델 설정을 로드한다.
"""

import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"))

# AWS
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Bedrock LLM 모델
LLM_MODEL = os.getenv("LLM_MODEL", "anthropic.claude-3-5-sonnet-20241022-v2:0")

# Knowledge Base
KNOWLEDGE_BASE_ID = os.getenv("KNOWLEDGE_BASE_ID", "")
