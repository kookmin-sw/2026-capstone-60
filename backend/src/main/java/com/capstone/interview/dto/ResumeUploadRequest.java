package com.capstone.interview.dto;

/**
 * 텍스트 이력서 직접 입력 요청.
 */
public record ResumeUploadRequest(
        String title,
        String originalText
) {}
