package com.capstone.interview.service;

import com.capstone.interview.dto.SessionCreateRequest;
import com.capstone.interview.dto.SessionCreateResponse;
import com.capstone.interview.dto.SessionEndResponse;
import com.capstone.interview.entity.CoverLetter;
import com.capstone.interview.entity.Interview;
import com.capstone.interview.entity.Member;
import com.capstone.interview.entity.Resume;
import com.capstone.interview.exception.UnauthorizedException;
import com.capstone.interview.repository.CoverLetterRepository;
import com.capstone.interview.repository.InterviewRepository;
import com.capstone.interview.repository.MemberRepository;
import com.capstone.interview.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InterviewService {

    private final InterviewRepository interviewRepository;
    private final MemberRepository memberRepository;
    private final ResumeRepository resumeRepository;
    private final CoverLetterRepository coverLetterRepository;
    private final LiveKitService liveKitService;
    private final EvaluationService evaluationService;

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

        Interview interview = Interview.builder()
                .member(member)
                .resume(resume)
                .coverLetter(coverLetter)
                .category(request.jobField())
                .sessionId(sessionId)
                .build();

        interview.start();
        interviewRepository.save(interview);

        String roomName = liveKitService.generateRoomName();
        String token = liveKitService.generateToken(roomName, "user-" + interview.getId());

        return new SessionCreateResponse(
                true,
                new SessionCreateResponse.Data(
                        sessionId,
                        new SessionCreateResponse.LiveKitInfo(roomName, liveKitService.getUrl(), token)
                )
        );
    }

    @Transactional
    public SessionEndResponse endSession(String sessionId, String reason) {
        Interview interview = interviewRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 세션입니다: " + sessionId));

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
}
