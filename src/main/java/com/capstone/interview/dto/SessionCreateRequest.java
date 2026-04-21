package com.capstone.interview.dto;

public record SessionCreateRequest(
    Long memberId,
    Long resumeId,
    Long coverLetterId,  // optional
    String jobField
) {}
