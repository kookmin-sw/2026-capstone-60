package com.capstone.interview.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Local/test LLM client that returns schema-compatible JSON without Bedrock.
 */
@Component
@ConditionalOnProperty(name = "llm.provider", havingValue = "mock", matchIfMissing = true)
public class MockLLMClient implements LLMClient {

    @Override
    public String invoke(String prompt) {
        return invoke("", prompt);
    }

    @Override
    public String invoke(String systemPrompt, String userPrompt) {
        String merged = ((systemPrompt == null ? "" : systemPrompt) + "\n" + (userPrompt == null ? "" : userPrompt))
                .toLowerCase();

        if (merged.contains("total_feedback") || merged.contains("competency_chart")) {
            return """
                    {
                      "total_feedback": "전반적으로 핵심 개념을 이해하고 답변하려는 흐름이 좋았습니다. 다만 일부 답변은 내부 동작 원리와 구체적 경험 연결이 부족해 깊이가 아쉬웠습니다. 앞으로는 개념의 원리, 적용 상황, 트레이드오프를 함께 정리하면 더 설득력 있는 면접 답변이 됩니다.",
                      "overall_score": "중",
                      "competency_chart": {
                        "기술역량": 7,
                        "문제해결력": 6,
                        "논리적 설명력": 7,
                        "직무적합성": 6
                      }
                    }
                    """;
        }

        if (merged.contains("claims") && merged.contains("이력서")) {
            return """
                    {
                      "summary": "AI 모의면접 프로젝트에서 백엔드와 RAG 기반 질문 생성 구조를 구현한 지원자",
                      "claims": [
                        {
                          "text": "AI 모의면접 시스템에서 이력서 텍스트 기반 맞춤형 기술 면접 질문 생성을 구현했다",
                          "keywords": ["AI 모의면접", "질문 생성", "이력서 기반"]
                        },
                        {
                          "text": "pgvector 기반 RAG 파이프라인을 구축하고 실제 면접 후기 크롤링 데이터로 질문 현실성을 높였다",
                          "keywords": ["pgvector", "RAG", "크롤링", "유사도 검색"]
                        }
                      ]
                    }
                    """;
        }

        return """
                {
                  "individual_feedback": "핵심 개념은 잘 짚었지만, 동작 원리와 실제 적용 경험을 함께 설명하면 더 설득력 있는 답변이 됩니다.",
                  "model_answer": "이 질문에는 개념 정의를 먼저 말하고, 동작 방식과 사용 이유를 간단히 설명한 뒤 프로젝트에서 적용한 사례나 트레이드오프를 덧붙이면 좋습니다."
                }
                """;
    }

    @Override
    public List<Float> embed(String text) {
        return List.of(0.1f, 0.2f, 0.3f);
    }
}
