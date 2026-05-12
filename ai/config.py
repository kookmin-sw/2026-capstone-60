"""AI/LLM 관련 설정. 환경 변수 로드."""

import os

# AWS
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# Bedrock LLM
LLM_MODEL = os.getenv("LLM_MODEL", "anthropic.claude-3-5-sonnet-20241022-v2:0")

# Knowledge Base (비어 있으면 RAG retrieve 를 skip 한다)
KNOWLEDGE_BASE_ID = os.getenv("KNOWLEDGE_BASE_ID", "")

# Retrieve 결과 개수
KB_TOP_K = int(os.getenv("KB_TOP_K", "4"))
