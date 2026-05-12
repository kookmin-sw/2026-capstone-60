package com.capstone.interview.service;

import com.capstone.interview.dto.NextTurnRequest;
import com.capstone.interview.dto.NextTurnResponse;
import com.capstone.interview.dto.SessionCreateRequest;
import com.capstone.interview.dto.SessionCreateResponse;
import com.capstone.interview.dto.SessionEndResponse;
import com.capstone.interview.entity.CoverLetter;
import com.capstone.interview.entity.Interview;
import com.capstone.interview.entity.InterviewQna;
import com.capstone.interview.entity.InterviewStatus;
import com.capstone.interview.entity.Member;
import com.capstone.interview.entity.Resume;
import com.capstone.interview.exception.InvalidStateException;
import com.capstone.interview.exception.SessionNotFoundException;
import com.capstone.interview.exception.UnauthorizedException;
import com.capstone.interview.repository.CoverLetterRepository;
import com.capstone.interview.repository.InterviewQnaRepository;
import com.capstone.interview.repository.InterviewRepository;
import com.capstone.interview.repository.MemberRepository;
import com.capstone.interview.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewService {

    private static final int ANSWER_TIME_LIMIT_SECONDS = 90;

    private final InterviewRepository interviewRepository;
    private final InterviewQnaRepository interviewQnaRepository;
    private final MemberRepository memberRepository;
    private final ResumeRepository resumeRepository;
    private final CoverLetterRepository coverLetterRepository;
    private final LiveKitService liveKitService;
    private final EvaluationService evaluationService;
    private final LiveKitRoomService liveKitRoomService;
    private final AgentDispatchService agentDispatchService;

    @Transactional
    public SessionCreateResponse createSession(SessionCreateRequest request) {
        if (request.jobField() == null || request.durationMinutes() == null) {
            throw new IllegalArgumentException("jobField와 durationMinutes는 필수입니다.");
        }

        Resume resume = null;
        if (request.resumeIds() != null) {
            resume = resumeRepository.findById(request.resumeIds())
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 이력서입니다: " + request.resumeIds()));
        }

        CoverLetter coverLetter = null;
        if (request.coverLetter() != null) {
            coverLetter = coverLetterRepository.findById(request.coverLetter())
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 자기소개서입니다: " + request.coverLetter()));
        }

        String loginId = SecurityContextHolder.getContext().getAuthentication().getName();
        Member member = memberRepository.findByLoginId(loginId)
                .orElseThrow(() -> new UnauthorizedException("인증된 사용자를 찾을 수 없습니다."));

        String sessionId = "sess-" + UUID.randomUUID();
        String roomName = liveKitService.generateRoomName();
        int totalDurationSeconds = request.durationMinutes() * 60;

        Interview interview = Interview.builder()
                .member(member)
                .resume(resume)
                .coverLetter(coverLetter)
                .category(request.jobField())
                .sessionId(sessionId)
                .roomName(roomName)
                .durationMinutes(request.durationMinutes())
                .build();

        interview.start();
        interviewRepository.save(interview);

        // Agent Dispatch
        String resumeText = resume != null ? resume.getOriginalText() : "";
        String coverLetterText = coverLetter != null ? coverLetter.getOriginalText() : "";

        try {
            agentDispatchService.dispatch(
                    roomName, sessionId, request.jobField(),
                    resumeText, coverLetterText,
                    totalDurationSeconds, ANSWER_TIME_LIMIT_SECONDS
            );
        } catch (Exception e) {
            log.error("[세션 생성] Agent dispatch 실패, 세션을 FAILED 처리합니다. sessionId={}", sessionId, e);
            interview.fail();
            throw new RuntimeException("Agent dispatch에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }

        // 첫 턴 초기화 (turnNumber=1)
        LocalDateTime now = LocalDateTime.now();
        InterviewQna firstTurn = InterviewQna.builder()
                .interview(interview)
                .sequenceNumber(1)
                .startedAt(now)
                .expiresAt(now.plusSeconds(ANSWER_TIME_LIMIT_SECONDS))
                .build();
        interviewQnaRepository.save(firstTurn);

        String token = liveKitService.generateToken(roomName, "user-" + member.getId());

        return new SessionCreateResponse(
                true,
                new SessionCreateResponse.Data(
                        sessionId,
                        new SessionCreateResponse.LiveKitInfo(roomName, liveKitService.getUrl(), token),
                        ANSWER_TIME_LIMIT_SECONDS,
                        totalDurationSeconds
                )
        );
    }

    @Transactional
    public NextTurnResponse nextTurn(String sessionId, NextTurnRequest request) {
        Interview interview = findInterviewOrThrow(sessionId);
        verifyOwner(interview);
        verifyInProgress(interview);

        // 현재 턴 번호 검증
        int currentTurn = interviewQnaRepository.countByInterview(interview);
        if (request.currentTurnNumber() != null && !request.currentTurnNumber().equals(currentTurn)) {
            log.warn("[/next] 턴 번호 불일치. 클라이언트={}, 서버={}", request.currentTurnNumber(), currentTurn);
        }

        int nextTurnNumber = currentTurn + 1;
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusSeconds(ANSWER_TIME_LIMIT_SECONDS);

        // 다음 턴 레코드 생성
        InterviewQna nextQna = InterviewQna.builder()
                .interview(interview)
                .sequenceNumber(nextTurnNumber)
                .startedAt(now)
                .expiresAt(expiresAt)
                .build();
        interviewQnaRepository.save(nextQna);

        // Agent 에 NEXT Data Message 전송 — 실패 시 롤백
        try {
            Map<String, Object> message = Map.of(
                    "type", "NEXT",
                    "payload", Map.of("turnNumber", nextTurnNumber)
            );
            liveKitRoomService.sendData(interview.getRoomName(), message);
        } catch (Exception e) {
            log.error("[/next] sendData 실패, 턴 증가를 롤백합니다. sessionId={}", sessionId, e);
            // 롤백: 방금 생성한 턴 레코드 삭제
            interviewQnaRepository.delete(nextQna);
            throw new RuntimeException("Agent에 다음 질문 신호 전송에 실패했습니다. 다시 시도해주세요.");
        }

        return new NextTurnResponse(
                true,
                new NextTurnResponse.Data(nextTurnNumber, now, expiresAt)
        );
    }

    @Transactional
    public SessionEndResponse endSession(String sessionId, String reason) {
        Interview interview = findInterviewOrThrow(sessionId);
        verifyOwner(interview);
        verifyInProgress(interview);

        // 1. Agent 에 END 메시지 전송 (실패해도 계속 진행)
        try {
            Map<String, Object> message = Map.of(
                    "type", "END",
                    "payload", Map.of("reason", reason != null ? reason : "USER_STOP")
            );
            liveKitRoomService.sendData(interview.getRoomName(), message);
        } catch (Exception e) {
            log.warn("[/end] sendData(END) 실패, deleteRoom으로 정리합니다. sessionId={}", sessionId);
        }

        // 2. Room 삭제 — Agent 강제 연결 종료
        liveKitRoomService.deleteRoom(interview.getRoomName());

        // 3. 세션 상태 COMPLETED 전환
        interview.complete();
        interviewRepository.save(interview);

        // EvaluationService 비동기 호출 (삭제)
        //evaluationService.evaluate(sessionId);

        return new SessionEndResponse(
                true,
                "면접이 종료되었습니다. AI 피드백을 생성 중입니다.",
                new SessionEndResponse.Data(interview.getStatus().name())
        );
    }

    private Interview findInterviewOrThrow(String sessionId) {
        return interviewRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new SessionNotFoundException("존재하지 않는 세션입니다: " + sessionId));
    }

    private void verifyOwner(Interview interview) {
        String loginId = SecurityContextHolder.getContext().getAuthentication().getName();
        Member member = interview.getMember();
        if (member == null || !member.getLoginId().equals(loginId)) {
            throw new UnauthorizedException("본인의 면접 세션만 제어할 수 있습니다.");
        }
    }

    private void verifyInProgress(Interview interview) {
        if (interview.getStatus() != InterviewStatus.IN_PROGRESS) {
            throw new InvalidStateException(
                    "IN_PROGRESS 상태에서만 가능합니다. 현재: " + interview.getStatus());
        }
    }
}
