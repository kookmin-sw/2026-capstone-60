package com.capstone.interview.repository;

import com.capstone.interview.entity.Resume;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ResumeRepository extends JpaRepository<Resume, Long> {

    List<Resume> findByMemberId(Long memberId);
}
