package com.capstone.interview.service;

import com.capstone.interview.dto.SessionCreateRequest;
import com.capstone.interview.dto.SessionCreateResponse;
import com.capstone.interview.dto.SessionEndResponse;
import com.capstone.interview.entity.CoverLetter;
import com.capstone.interview.entity.Interview;
import com.capstone.interview.entity.Member;
import com.capstone.interview.entity.Resume;
import com.capstone.interview.repository.InterviewRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InterviewService {

    private final InterviewRepository interviewRepository;
    private final LiveKitService liveKitService;
    private final EntityManager entityManager;

    @Transactional
    public SessionCreateResponse createSession(SessionCreateRequest request) {
        if (request.memberId() == null || request.jobField() == null) {
            throw new IllegalArgumentException("memberId와 jobField는 필수입니다.");
        }

        Member member = entityManager.getReference(Member.class, request.memberId());
        Resume resume = request.resumeId() != null
                ? entityManager.getReference(Resume.class, request.resumeId()) : null;
        CoverLetter coverLetter = request.coverLetterId() != null
                ? entityManager.getReference(CoverLetter.class, request.coverLetterId()) : null;

        Interview interview = Interview.builder()
                .member(member)
                .resume(resume)
                .coverLetter(coverLetter)
                .category(request.jobField())
                .build();

        interview.start();
        interviewRepository.save(interview);

        String roomName = liveKitService.generateRoomName();
        String token = liveKitService.generateToken(roomName, "user-" + request.memberId());

        return new SessionCreateResponse(
                true,
                new SessionCreateResponse.Data(
                        interview.getId(),
                        new SessionCreateResponse.LiveKitInfo(roomName, liveKitService.getUrl(), token)
                )
        );
    }

    @Transactional
    public SessionEndResponse endSession(Long sessionId, String reason) {
        Interview interview = interviewRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 세션입니다: " + sessionId));

        interview.complete();

        return new SessionEndResponse(
                true,
                "면접이 종료되었습니다. AI 피드백을 생성 중입니다.",
                new SessionEndResponse.Data(interview.getStatus().name())
        );
    }
}
