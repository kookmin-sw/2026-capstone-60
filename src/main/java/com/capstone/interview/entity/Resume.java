package com.capstone.interview.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "resumes")
@Getter
@NoArgsConstructor
public class Resume {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "original_text", columnDefinition = "TEXT")
    private String originalText;

    @Column(name = "file_url", length = 1024)
    private String fileUrl;

    // JSON 타입 — 실제 파싱/직렬화는 서비스 레이어에서 처리
    @Column(columnDefinition = "json")
    private String keywords;

    // TODO: pgvector 타입 지원 시 vector(1536)으로 교체 (현재 JPA 기본 미지원)
    @Transient
    private float[] embedding;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
