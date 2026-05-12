package com.capstone.interview.repository;

import com.capstone.interview.entity.Interview;
import com.capstone.interview.entity.InterviewQna;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface InterviewQnaRepository extends JpaRepository<InterviewQna, Long> {
    // 면접의 모든 질문-답변을 순서대로 조회
    List<InterviewQna> findByInterviewOrderBySequenceNumberAsc(Interview interview);
    Optional<InterviewQna> findByInterviewAndSequenceNumber(Interview interview, Integer sequenceNumber);
    int countByInterview(Interview interview);
}
