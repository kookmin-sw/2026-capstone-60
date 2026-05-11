package com.capstone.interview.controller;

import com.capstone.interview.service.EvaluationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/v1/interviews")
public class EvaluationController {

    private final EvaluationService evaluationService;

    /**
     * 면접 평가 API.
     * 면접 종료 후 호출하면 LLM이 질문-답변을 평가하고 피드백을 저장한다.
     */
    @PostMapping("/{sessionId}/evaluate")
    public ResponseEntity<Map<String, String>> evaluate(@PathVariable String sessionId) {
        evaluationService.evaluate(sessionId);
        return ResponseEntity.accepted()
                .body(Map.of("message", "AI 피드백을 생성 중입니다."));
    }
}

