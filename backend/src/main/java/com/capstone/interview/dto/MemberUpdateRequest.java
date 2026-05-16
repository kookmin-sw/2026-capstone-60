package com.capstone.interview.dto;

public record MemberUpdateRequest(
        String name,
        String currentPassword,
        String newPassword
) {}
