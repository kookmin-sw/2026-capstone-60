package com.capstone.interview.dto;

public record InternalSpeakerRequest(
    Integer turnNumber,
    Long memberId,
    String identity
) {}
