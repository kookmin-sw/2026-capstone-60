package com.capstone.interview.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Bedrock Claude client for interview evaluation prompts.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "llm.provider", havingValue = "bedrock")
public class BedrockLLMClient implements LLMClient {

    private final BedrockRuntimeClient bedrockRuntimeClient;
    private final ObjectMapper objectMapper;

    @Value("${llm.bedrock.model-id:us.anthropic.claude-sonnet-4-6}")
    private String modelId;

    @Value("${llm.bedrock.max-tokens:1200}")
    private int maxTokens;

    @Value("${llm.bedrock.temperature:0.2}")
    private double temperature;

    @Override
    public String invoke(String prompt) {
        return invoke("", prompt);
    }

    @Override
    public String invoke(String systemPrompt, String userPrompt) {
        try {
            Map<String, Object> body = Map.of(
                    "anthropic_version", "bedrock-2023-05-31",
                    "max_tokens", maxTokens,
                    "temperature", temperature,
                    "system", systemPrompt == null ? "" : systemPrompt,
                    "messages", List.of(Map.of(
                            "role", "user",
                            "content", List.of(Map.of(
                                    "type", "text",
                                    "text", userPrompt == null ? "" : userPrompt
                            ))
                    ))
            );

            InvokeModelRequest request = InvokeModelRequest.builder()
                    .modelId(modelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .body(SdkBytes.fromUtf8String(objectMapper.writeValueAsString(body)))
                    .build();

            InvokeModelResponse response = bedrockRuntimeClient.invokeModel(request);
            JsonNode root = objectMapper.readTree(response.body().asUtf8String());
            return root.path("content").path(0).path("text").asText();
        } catch (Exception e) {
            throw new IllegalStateException("Bedrock LLM invocation failed", e);
        }
    }

    @Override
    public List<Float> embed(String text) {
        return new ArrayList<>();
    }
}
