package com.capstone.interview.service;

import com.capstone.interview.dto.FeedbackResponse;
import com.capstone.interview.dto.QAPair;
import com.capstone.interview.entity.Interview;
import com.capstone.interview.entity.InterviewQna;
import com.capstone.interview.entity.InterviewStatus;
import com.capstone.interview.repository.InterviewQnaRepository;
import com.capstone.interview.repository.InterviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.capstone.interview.entity.Member;
import com.capstone.interview.exception.UnauthorizedException;
import com.capstone.interview.repository.MemberRepository;

import com.capstone.interview.dto.FeedbackListDto;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final InterviewRepository interviewRepository;
    private final InterviewQnaRepository interviewQnaRepository;
    private final MemberRepository memberRepository;


    /**
     * 면접 결과 피드백 조회
     */
    @Transactional(readOnly = true)
    public FeedbackResponse getFeedback(String sessionId) {
        // 1. 면접 정보 조회
        Interview interview = interviewRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 면접 세션입니다: " + sessionId));

        // 2. 피드백 생성 여부 체크 (null이면 생성 중으로 판단)
        String rawFeedback = interview.getTotalFeedback();
        if (rawFeedback == null) {
            return FeedbackResponse.builder()
                    .success(false)
                    .totalFeedback("AI 피드백이 생성 중입니다. 잠시 후 다시 시도해주세요.")
                    .build();
        }

        // 3. 질문-답변 리스트 조회
        List<InterviewQna> qnas = interviewQnaRepository
                .findByInterviewOrderBySequenceNumberAsc(interview);

        // 4. QAPair 리스트 변환 로직
        List<QAPair> qaPairs = qnas.stream()
                .map(qna -> QAPair.builder()
                        .sequenceNumber(qna.getSequenceNumber())
                        .questionContent(qna.getQuestionContent())
                        .answerContent(qna.getAnswerContent())
                        .modelAnswer(qna.getModelAnswer())
                        .individualFeedback(qna.getIndividualFeedback())
                        .isFollowUp(qna.isFollowUp()) // 엔티티의 메서드 사용
                        .build())
                .toList();

        // 5. 텍스트 데이터 가공 (차트 데이터 분리)
        String onlyChart = extractChartData(rawFeedback);
        // [SCORE] 태그 앞부분만 피드백 본문으로 추출
        String onlyFeedback = rawFeedback.split("\n\n\\[SCORE\\]")[0];

        // 6. 결과 반환 (DTO 포장)
        return FeedbackResponse.builder()
                .success(true)
                .totalFeedback(onlyFeedback)
                .overallScore(extractOverallScore(rawFeedback))
                .competencyChart(onlyChart) // 프론트 전달용 JSON 문자열
                .qaPairs(qaPairs)
                .build();
    }

    // ──────────────────────────────────────────────────────────────────
    // 면접 기록 목록 조회 (마이페이지)
    // ──────────────────────────────────────────────────────────────────

    /**
     * 사용자의 면접 기록 목록 조회
     */
    @Transactional(readOnly = true)
    public List<FeedbackListDto> getFeedbackList(String loginId) {
        Member member = memberRepository.findByLoginId(loginId)
                .orElseThrow(() -> new UnauthorizedException("회원 정보를 찾을 수 없습니다."));
        // 면접 status가 COMPLETED인 상태만 조회
        List<Interview> interviews = interviewRepository.findByMemberIdAndStatusOrderByCreatedAtDesc(member.getId(), InterviewStatus.COMPLETED);


        return interviews.stream()
                .map(interview -> FeedbackListDto.builder()
                        .sessionId(interview.getSessionId())
                        .category(interview.getCategory())
                        .overallScore(extractOverallScore(interview.getTotalFeedback()))
                        .createdAt(interview.getCreatedAt())
                        .build())
                .toList();
    }

    /**
     * [competencyChart] (역량차트) 태그 뒤의 JSON 데이터를 추출하는 헬퍼 메서드
     */
    private String extractChartData(String rawData) {
        if (rawData != null && rawData.contains("[CHART]")) {
            return rawData.substring(rawData.indexOf("[CHART]") + "[CHART]".length()).trim();
        }
        return "{}";
    }

    /*
    * [overallScore] 상중하 추출 메소드
    * */
    private String extractOverallScore(String rawFeedback) {
        if (rawFeedback == null || !rawFeedback.contains("[SCORE]")) return null;
        int start = rawFeedback.indexOf("[SCORE]") + "[SCORE]\n".length();
        int end = rawFeedback.indexOf("\n\n[CHART]", start);
        if (end == -1) end = rawFeedback.length();
        String score = rawFeedback.substring(start, end).trim();
        return score.isEmpty() ? null : score;
    }
}
