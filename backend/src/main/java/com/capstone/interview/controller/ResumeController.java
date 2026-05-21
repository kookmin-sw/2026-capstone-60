package com.capstone.interview.controller;

import com.capstone.interview.dto.ResumeResponse;
import com.capstone.interview.dto.ResumeUploadRequest;
import com.capstone.interview.service.ResumeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * 이력서 업로드 및 조회 API.
 */
@Slf4j
@RestController
@RequestMapping("/v1/resumes")
@RequiredArgsConstructor
public class ResumeController {

    private final ResumeService resumeService;

    /**
     * PDF 이력서 업로드.
     * POST /v1/resumes/upload-pdf
     */
    @PostMapping("/upload-pdf")
    public ResponseEntity<ResumeResponse> uploadPdf(
            Authentication authentication,
            @RequestParam("title") String title,
            @RequestParam("file") MultipartFile file) throws IOException {

        String loginId = authentication.getName();
        log.info("[이력서 PDF 업로드] loginId={}, title={}, fileSize={}",
                loginId, title, file.getSize());

        if (file.isEmpty()) {
            throw new IllegalArgumentException("파일이 비어있습니다.");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            throw new IllegalArgumentException("PDF 파일만 업로드 가능합니다.");
        }

        ResumeResponse response = resumeService.uploadPdfResume(loginId, title, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 텍스트 이력서 직접 입력.
     * POST /v1/resumes/upload-text
     */
    @PostMapping("/upload-text")
    public ResponseEntity<ResumeResponse> uploadText(
            Authentication authentication,
            @RequestBody ResumeUploadRequest request) {

        String loginId = authentication.getName();
        log.info("[이력서 텍스트 입력] loginId={}, title={}", loginId, request.title());

        ResumeResponse response = resumeService.uploadTextResume(loginId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 내 이력서 목록 조회.
     * GET /v1/resumes
     */
    @GetMapping
    public ResponseEntity<List<ResumeResponse>> getMyResumes(Authentication authentication) {
        String loginId = authentication.getName();
        return ResponseEntity.ok(resumeService.getResumesByLoginId(loginId));
    }

    /**
     * 이력서 상세 조회.
     * GET /v1/resumes/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ResumeResponse> getResume(@PathVariable Long id) {
        return ResponseEntity.ok(resumeService.getResume(id));
    }

    /**
     * 이력서 삭제.
     * DELETE /v1/resumes/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteResume(
            Authentication authentication,
            @PathVariable Long id) {

        String loginId = authentication.getName();
        log.info("[이력서 삭제] loginId={}, resumeId={}", loginId, id);

        resumeService.deleteResume(loginId, id);
        return ResponseEntity.noContent().build();
    }
}
