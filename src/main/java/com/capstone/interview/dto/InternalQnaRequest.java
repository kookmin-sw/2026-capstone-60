package com.capstone.interview.dto;

import java.util.List;

public record InternalQnaRequest(
    Integer turnNumber,
    String question,
    String intent,
    Boolean isFollowUp,
    Integer parentTurnNumber,
    String answer,
    List<String> answerSummary,
    String followUpDecision,
    String focusPoint,
    Long respondentMemberId
) {}
