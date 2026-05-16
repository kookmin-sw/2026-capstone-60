package com.capstone.interview.dto;

public record LoginResponse(
    boolean success,
    LoginResponse.Data data
) {
    public record Data(
        String accessToken,
        String tokenType,   // "Bearer"
        long expiresIn      // 초 단위
    ) {}
}
