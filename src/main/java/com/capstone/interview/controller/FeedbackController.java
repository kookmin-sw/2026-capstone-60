package com.capstone.interview.controller;

import com.capstone.interview.dto.FeedbackListDto;
import com.capstone.interview.dto.FeedbackResponse;
import com.capstone.interview.service.FeedbackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * [피드백 전용 컨트롤러]
 * 평가(Evaluation)와 분리되어, 오직 면접 결과 조회만 담당합니다.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/v1/interviews")
public class FeedbackController {

    private final FeedbackService feedbackService;

    /**
     * 면접 결과 피드백 상세 조회
     * GET /v1/interviews/feedback/{sessionId}
     * * @return 개별평가, 개별모범답안, 전체 피드백이 모두 담긴 FeedbackResponse
     */
    @GetMapping("/feedback/{sessionId}")
    public ResponseEntity<FeedbackResponse> getFeedback(@PathVariable String sessionId) {
        log.info("[피드백 조회 시작] sessionId: {}", sessionId);

        // 1. 서비스에서 모든 피드백 정보(전체 총평 + 개별 문항 세트)를 가져옴
        FeedbackResponse response = feedbackService.getFeedback(sessionId);

        log.info("[피드백 조회 완료] sessionId: {}", sessionId);

        // 2. ResponseEntity에 FeedbackResponse 객체를 담아 전송
        return ResponseEntity.ok(response);
    }

    /**
     * 면접 기록 목록 조회 (마이페이지)
     * GET /v1/interviews/feedbackList
     * JWT 토큰에서 회원 정보를 추출하여 본인의 면접 기록만 조회
     */
    @GetMapping("/feedbackList")
    public ResponseEntity<List<FeedbackListDto>> getFeedbackList(Authentication authentication) {
        String loginId = authentication.getName();
        List<FeedbackListDto> list = feedbackService.getFeedbackList(loginId);
        return ResponseEntity.ok(list);
    }

}
