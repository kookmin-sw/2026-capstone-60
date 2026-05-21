package com.capstone.interview.config;

import java.util.List;

/**
 * Common interface for LLM calls.
 */
public interface LLMClient {

    /** Sends a single prompt and returns a text response. */
    String invoke(String prompt);

    /**
     * Sends stable instructions separately from per-request input.
     */
    default String invoke(String systemPrompt, String userPrompt) {
        if (systemPrompt == null || systemPrompt.isBlank()) {
            return invoke(userPrompt);
        }
        return invoke(systemPrompt + "\n\n" + userPrompt);
    }

    /** Converts text into an embedding vector. */
    List<Float> embed(String text);
}
