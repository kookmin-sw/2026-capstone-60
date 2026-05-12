package com.capstone.interview.dto;

import java.time.LocalDateTime;

/**
 * 이력서 응답 DTO.
 */
public record ResumeResponse(
        Long id,
        String title,
        String originalText,
        String fileUrl,
        String keywords,
        LocalDateTime createdAt
) {}
