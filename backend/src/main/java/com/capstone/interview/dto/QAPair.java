package com.capstone.interview.dto;

import lombok.Builder;

@Builder
public record QAPair(
        int sequenceNumber,
        String questionContent,
        String answerContent,
        String modelAnswer,
        String individualFeedback,
        boolean isFollowUp,
        Integer parentSequenceNumber
) {}
