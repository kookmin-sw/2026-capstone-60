"""
답변 요약 AI 모듈.

STT 텍스트에서 노이즈를 제거하고, 면접자가 실제로 말한 핵심 주장만
객관적 사실로 추출하여 JSON으로 반환한다.
"""

import json

import boto3


SYSTEM_PROMPT = """\
# Role
당신은 AI 모의 면접 시스템에서 '답변 요약'을 담당하는 데이터 정제 에이전트입니다.
사용자의 음성 인식(STT) 텍스트를 입력받아, 기계(판단 AI)가 논리적으로 검토할 수 있도록
객관적인 사실만 추출하여 JSON 포맷으로 변환하는 것이 유일한 목표입니다.

# Core Directives
1. STT 노이즈 제거: 추임새("어...", "음..."), 말 더듬음, 한숨, 면접과 무관한 혼잣말은
완전히 무시하고 오직 의미 있는 정보만 추출하십시오.
2. 가치 판단 절대 금지: 답변이 질문 의도에 맞는지, 정답/오답인지 절대 평가하지 마십시오.
오직 면접자가 "무슨 말을 했는지" 사실만 기록하십시오.
3. 환각 방지: 직접 언급하지 않은 내용을 문맥상 유추하여 임의로 추가하지 마십시오.
4. 객관적 평서문 사용: 제3자의 관점에서 "~함", "~라고 답변함" 형태의 간결한 평서문으로
작성하십시오.

# Extraction Rules
- extracted_claims: 면접자의 핵심 주장, 기술적 설명, 본인이 언급한 경험을
1~4개의 문장으로 압축하여 추출합니다.

# Output Format
마크다운 코드 블록(```json ```)이나 부연 설명 없이 오직 순수한 JSON 문자열만 출력하십시오.
{"extracted_claims": ["string", "string"]}
"""


class AnswerSummarizer:
    """STT 답변에서 객관적 사실만 추출한다."""

    DEFAULT_TEMPERATURE = 0.0
    DEFAULT_TOP_K = 1
    DEFAULT_MAX_TOKENS = 512

    def __init__(
        self,
        model_id: str,
        region: str,
        temperature: float | None = None,
        top_k: int | None = None,
    ):
        self.model_id = model_id
        self.temperature = (
            temperature if temperature is not None else self.DEFAULT_TEMPERATURE
        )
        self.top_k = top_k if top_k is not None else self.DEFAULT_TOP_K
        self.client = boto3.client("bedrock-runtime", region_name=region)

    def _call_bedrock(self, answer: str) -> str:
        response = self.client.invoke_model(
            modelId=self.model_id,
            body=json.dumps(
                {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": self.DEFAULT_MAX_TOKENS,
                    "temperature": self.temperature,
                    "top_k": self.top_k,
                    "system": SYSTEM_PROMPT,
                    "messages": [{"role": "user", "content": answer}],
                }
            ),
        )
        result = json.loads(response["body"].read())
        return result["content"][0]["text"]

    def summarize(self, answer: str) -> dict[str, list[str]]:
        if not answer or not answer.strip():
            return {"extracted_claims": []}

        raw = self._call_bedrock(answer)
        cleaned = _strip_markdown_code_fence(raw)
        parsed = json.loads(cleaned)

        claims = parsed.get("extracted_claims")
        if not isinstance(claims, list):
            raise ValueError("extracted_claims는 리스트여야 합니다.")

        normalized = [
            claim.strip() for claim in claims if isinstance(claim, str) and claim.strip()
        ]
        return {"extracted_claims": normalized}


def _strip_markdown_code_fence(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    return cleaned.strip()
