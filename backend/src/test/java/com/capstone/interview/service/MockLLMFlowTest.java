package com.capstone.interview.service;

import com.capstone.interview.config.LLMClient;
import com.capstone.interview.config.MockLLMClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MockLLMFlowTest {

    private final LLMClient llmClient = new MockLLMClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void mockLLM_returns_turn_evaluation_json() throws Exception {
        String response = llmClient.invoke("turn evaluator", "질문과 답변 요약으로 individual_feedback과 model_answer를 생성하세요.");
        JsonNode root = objectMapper.readTree(response.trim());

        assertTrue(root.has("individual_feedback"));
        assertTrue(root.has("model_answer"));
        assertFalse(root.path("individual_feedback").asText().isBlank());
        assertFalse(root.path("model_answer").asText().isBlank());
    }

    @Test
    void mockLLM_returns_total_evaluation_json() throws Exception {
        String response = llmClient.invoke("total evaluator", "total_feedback, overall_score, competency_chart를 생성하세요.");
        JsonNode root = objectMapper.readTree(response.trim());

        assertTrue(root.has("total_feedback"));
        assertTrue(root.has("overall_score"));
        assertTrue(root.has("competency_chart"));
        assertEquals("중", root.path("overall_score").asText());
        assertTrue(root.path("competency_chart").path("기술역량").asInt() > 0);
    }

    @Test
    void combined_format_can_be_split_for_feedback_response() {
        String totalFeedback = "전반적으로 준비가 잘 된 면접이었습니다.";
        String overallScore = "중";
        String competencyChart = "{\"기술역량\":7}";

        String combined = totalFeedback + "\n\n[SCORE]\n" + overallScore + "\n\n[CHART]\n" + competencyChart;

        String onlyFeedback = combined.split("\n\n\\[SCORE\\]")[0];
        assertEquals(totalFeedback, onlyFeedback);

        String chart = combined.substring(combined.indexOf("[CHART]") + "[CHART]".length()).trim();
        assertEquals(competencyChart, chart);

        int start = combined.indexOf("[SCORE]") + "[SCORE]\n".length();
        int end = combined.indexOf("\n\n[CHART]", start);
        String score = combined.substring(start, end).trim();
        assertEquals(overallScore, score);
    }
}
