package com.capstone.interview.dto;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter
@Builder
public class FeedbackResponse {
    private boolean success;
    private String totalFeedback; // AI의 전체 총평
    private String overallScore;
    private String competencyChart; //차트
    private List<QAPair> qaPairs; // 질문-답변-개별피드백 세트 리스트
}