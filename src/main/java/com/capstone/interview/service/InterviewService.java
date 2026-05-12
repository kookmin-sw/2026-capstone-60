package com.capstone.interview.service;

import com.capstone.interview.dto.SessionCreateRequest;
import com.capstone.interview.dto.SessionCreateResponse;
import com.capstone.interview.dto.SessionEndResponse;
import com.capstone.interview.entity.CoverLetter;
import com.capstone.interview.entity.Interview;
import com.capstone.interview.entity.InterviewQna;
import com.capstone.interview.entity.Member;
import com.capstone.interview.entity.Resume;
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
    public SessionEndResponse endSession(String sessionId, String reason) {
        Interview interview = interviewRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 세션입니다: " + sessionId));

        interview.complete();

        return new SessionEndResponse(
                true,
                "면접이 종료되었습니다. AI 피드백을 생성 중입니다.",
                new SessionEndResponse.Data(interview.getStatus().name())
        );
    }
}
