package com.capstone.interview.service;

import com.capstone.interview.config.MockLLMClient;
import com.capstone.interview.config.LLMClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * MockLLMClient의 응답이 EvaluationService 파싱 로직과 호환되는지 검증.
 * DB/Spring 컨텍스트 없이 순수 단위 테스트.
 */
class MockLLMFlowTest {

    private final LLMClient llmClient = new MockLLMClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void mockLLM_응답이_정상_JSON으로_파싱되는지() throws Exception {
        // MockLLM 호출
        String response = llmClient.invoke("테스트 프롬프트");

        // JSON 파싱
        JsonNode root = objectMapper.readTree(response.trim());

        // individual_feedbacks 존재 확인
        assertTrue(root.has("individual_feedbacks"));
        assertTrue(root.path("individual_feedbacks").isArray());
        assertEquals(1, root.path("individual_feedbacks").size());

        // total_feedback 존재 확인
        assertTrue(root.has("total_feedback"));
        assertFalse(root.path("total_feedback").asText().isBlank());

        // competency_chart 존재 확인
        assertTrue(root.has("competency_chart"));
        assertEquals(80, root.path("competency_chart").path("기술역량").asInt());

        // overall_score 존재 확인
        assertEquals("중", root.path("overall_score").asText());

        System.out.println("=== MockLLM 응답 ===");
        System.out.println(response);
        System.out.println("=== 파싱 결과 ===");
        System.out.println("total_feedback: " + root.path("total_feedback").asText());
        System.out.println("overall_score: " + root.path("overall_score").asText());
        System.out.println("competency_chart: " + root.path("competency_chart"));
    }

    @Test
    void combined_포맷_저장_후_FeedbackService_파싱_검증() {
        // EvaluationService가 저장하는 포맷 시뮬레이션
        String totalFeedback = "전반적으로 준비가 잘 된 면접이었습니다.";
        String overallScore = "중";
        String competencyChart = "{\"기술역량\":80}";

        String combined = totalFeedback + "\n\n[SCORE]\n" + overallScore + "\n\n[CHART]\n" + competencyChart;

        System.out.println("=== 저장되는 combined 문자열 ===");
        System.out.println(combined);
        System.out.println("================================");

        // FeedbackService.getFeedback() 파싱 로직 재현
        String onlyFeedback = combined.split("\n\n\\[SCORE\\]")[0];
        assertEquals("전반적으로 준비가 잘 된 면접이었습니다.", onlyFeedback);

        // extractChartData 로직 재현
        String chart = combined.substring(combined.indexOf("[CHART]") + "[CHART]".length()).trim();
        assertEquals("{\"기술역량\":80}", chart);

        // extractOverallScore 로직 재현
        int tagEnd = combined.indexOf("[SCORE]") + "[SCORE]".length();
        int start = combined.indexOf("\n", tagEnd);
        start++;
        int end = combined.indexOf("\n", start);
        String score = combined.substring(start, end).trim();
        assertEquals("중", score);

        System.out.println("onlyFeedback: " + onlyFeedback);
        System.out.println("chart: " + chart);
        System.out.println("score: " + score);
    }
}
