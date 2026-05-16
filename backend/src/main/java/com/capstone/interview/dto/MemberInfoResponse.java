package com.capstone.interview.dto;

import java.time.LocalDateTime;

public record MemberInfoResponse(
        boolean success,
        Data data
) {
    public record Data(
            Long id,
            String loginId,
            String name,
            LocalDateTime createdAt
    ) {}
}
