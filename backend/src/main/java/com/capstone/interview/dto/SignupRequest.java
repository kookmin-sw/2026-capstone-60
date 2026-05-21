package com.capstone.interview.dto;

public record SignupRequest(
    String loginId,   // 필수
    String password,  // 필수
    String name       // 필수
) {}
