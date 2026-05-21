package com.capstone.interview.service;

import com.capstone.interview.config.MockLLMClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumePreprocessorServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ResumePreprocessorService service = new ResumePreprocessorService(
            new MockLLMClient(),
            objectMapper
    );

    @Test
    void preprocess_returns_summary_and_claims_with_keywords() throws Exception {
        String result = service.preprocess("""
                AI 모의면접 시스템
                Spring Boot 백엔드와 pgvector 기반 RAG 파이프라인을 구축했습니다.
                실제 면접 후기 크롤링 데이터로 질문 현실성을 높였습니다.
                """);

        JsonNode root = objectMapper.readTree(result);

        assertFalse(root.path("summary").asText().isBlank());
        assertTrue(root.path("claims").isArray());
        assertFalse(root.path("claims").isEmpty());
        assertFalse(root.path("claims").get(0).path("text").asText().isBlank());
        assertTrue(root.path("claims").get(0).path("keywords").isArray());
        assertFalse(root.path("claims").get(0).path("keywords").isEmpty());
    }
}
