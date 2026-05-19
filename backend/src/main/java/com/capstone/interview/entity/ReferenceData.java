package com.capstone.interview.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "reference_data")
@Getter
@NoArgsConstructor
public class ReferenceData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_role", length = 50)
    private String jobRole;

    @Column(columnDefinition = "TEXT")
    private String question;

    // TODO: pgvector 타입 지원 시 vector(1536)으로 교체 (현재 JPA 기본 미지원)
    @Transient
    private float[] embedding;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
