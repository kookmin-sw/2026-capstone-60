package com.capstone.interview.dto;

public record SignupResponse(
    boolean success,
    SignupResponse.Data data
) {
    public record Data(
        Long id,
        String loginId,
        String name
    ) {}
}
