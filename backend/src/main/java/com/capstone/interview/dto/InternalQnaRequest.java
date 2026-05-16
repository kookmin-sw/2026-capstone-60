package com.capstone.interview.dto;

public record InternalQnaRequest(
    Integer turnNumber,
    String question,
    String intent,
    Boolean isFollowUp,
    String answer
) {}
