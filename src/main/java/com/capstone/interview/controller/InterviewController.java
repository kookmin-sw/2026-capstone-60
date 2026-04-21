package com.capstone.interview.controller;

import com.capstone.interview.dto.SessionCreateRequest;
import com.capstone.interview.dto.SessionCreateResponse;
import com.capstone.interview.dto.SessionEndRequest;
import com.capstone.interview.dto.SessionEndResponse;
import com.capstone.interview.service.InterviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/sessions")
@RequiredArgsConstructor
public class InterviewController {

    private final InterviewService interviewService;

    @PostMapping
    public ResponseEntity<SessionCreateResponse> createSession(@RequestBody SessionCreateRequest request) {
        return ResponseEntity.ok(interviewService.createSession(request));
    }

    @PostMapping("/{sessionId}/end")
    public ResponseEntity<SessionEndResponse> endSession(
            @PathVariable Long sessionId,
            @RequestBody SessionEndRequest request) {
        return ResponseEntity.ok(interviewService.endSession(sessionId, request.reason()));
    }
}
