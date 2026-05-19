package com.capstone.interview.dto;

public record MemberUpdateResponse(
        boolean success,
        Data data
) {
    public record Data(
            Long id,
            String loginId,
            String name
    ) {}
}
