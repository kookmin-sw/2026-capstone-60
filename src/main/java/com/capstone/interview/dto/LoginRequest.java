package com.capstone.interview.dto;

public record LoginRequest(
    String loginId,   // 필수
    String password   // 필수
) {}
