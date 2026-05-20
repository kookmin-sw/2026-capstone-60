package com.capstone.interview.controller;

import com.capstone.interview.dto.InternalQnaRequest;
import com.capstone.interview.dto.InternalSpeakerRequest;
import com.capstone.interview.service.InternalQnaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/internal/v1/interviews/sessions")
@RequiredArgsConstructor
public class InternalQnaController {

    private final InternalQnaService internalQnaService;

    @PostMapping("/{sessionId}/qnas")
    public ResponseEntity<Map<String, Boolean>> saveQna(
            @PathVariable String sessionId,
            @RequestBody InternalQnaRequest request) {
        log.info("[QnA 저장] sessionId={}, turnNumber={}", sessionId, request.turnNumber());

        internalQnaService.upsertQna(sessionId, request);

        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/{sessionId}/speaker")
    public ResponseEntity<Map<String, Boolean>> updateCurrentSpeaker(
            @PathVariable String sessionId,
            @RequestBody InternalSpeakerRequest request) {
        log.info("[Current speaker update] sessionId={}, turnNumber={}, memberId={}, identity={}",
                sessionId, request.turnNumber(), request.memberId(), request.identity());

        internalQnaService.updateCurrentSpeaker(sessionId, request);

        return ResponseEntity.ok(Map.of("success", true));
    }
}
