package com.capstone.interview.dto;

import lombok.Builder;
import java.time.LocalDateTime;

//status가 COMPLETED인 것만 보여줌.
@Builder
public record FeedbackListDto(
        String sessionId,
        String category,
        String overallScore,
        LocalDateTime createdAt
) {}
