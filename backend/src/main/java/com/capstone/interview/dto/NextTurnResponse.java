package com.capstone.interview.dto;

import java.time.LocalDateTime;

public record NextTurnResponse(
    boolean success,
    NextTurnResponse.Data data
) {
    public record Data(
        int turnNumber,
        LocalDateTime startedAt,
        LocalDateTime expiresAt
    ) {}
}
