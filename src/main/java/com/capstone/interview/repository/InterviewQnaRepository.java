package com.capstone.interview.repository;

import com.capstone.interview.entity.Interview;
import com.capstone.interview.entity.InterviewQna;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InterviewQnaRepository extends JpaRepository<InterviewQna, Long> {

    Optional<InterviewQna> findByInterviewAndSequenceNumber(Interview interview, Integer sequenceNumber);

    int countByInterview(Interview interview);
}
