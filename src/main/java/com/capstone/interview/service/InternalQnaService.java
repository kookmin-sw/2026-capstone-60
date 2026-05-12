package com.capstone.interview.service;

import com.capstone.interview.dto.InternalQnaRequest;
import com.capstone.interview.entity.Interview;
import com.capstone.interview.entity.InterviewQna;
import com.capstone.interview.exception.SessionNotFoundException;
import com.capstone.interview.repository.InterviewQnaRepository;
import com.capstone.interview.repository.InterviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class InternalQnaService {

    private final InterviewRepository interviewRepository;
    private final InterviewQnaRepository interviewQnaRepository;

    /**
     * Agent 가 매 턴 전송하는 Q+A 를 upsert 한다.
     * (session_id, turn_number) 유니크 제약 기반 — 같은 턴이 재시도로 두 번 도착해도
     * DB 는 최종 상태 하나만 유지한다.
     */
    @Transactional
    public void upsertQna(String sessionId, InternalQnaRequest request) {
        Interview interview = interviewRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new SessionNotFoundException("존재하지 않는 세션입니다: " + sessionId));

        InterviewQna existing = interviewQnaRepository
                .findByInterviewAndSequenceNumber(interview, request.turnNumber())
                .orElse(null);

        if (existing != null) {
            // upsert: 기존 레코드 업데이트
            if (request.question() != null) {
                existing.updateQuestion(
                        request.question(),
                        request.intent(),
                        request.isFollowUp() != null && request.isFollowUp()
                );
            }
            if (request.answer() != null) {
                existing.updateAnswer(request.answer());
            }
            log.info("[QnA upsert] 기존 턴 업데이트. sessionId={}, turn={}", sessionId, request.turnNumber());
        } else {
            // insert: 새 레코드 생성
            InterviewQna newQna = InterviewQna.builder()
                    .interview(interview)
                    .sequenceNumber(request.turnNumber())
                    .questionContent(request.question())
                    .answerContent(request.answer() != null ? request.answer() : "")
                    .isFollowUp(request.isFollowUp() != null && request.isFollowUp())
                    .intent(request.intent())
                    .build();
            interviewQnaRepository.save(newQna);
            log.info("[QnA insert] 새 턴 저장. sessionId={}, turn={}", sessionId, request.turnNumber());
        }
    }
}
