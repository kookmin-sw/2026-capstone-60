package com.capstone.interview.exception;

import java.time.LocalDateTime;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 전역 예외 처리.
 * 모든 Controller에서 발생한 예외를 잡아 ErrorResponse로 변환한다.
 * 새 에러 종류가 필요하면 커스텀 예외 클래스 + @ExceptionHandler 메서드를 추가.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 입력값 검증 오류 (400) */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleValidation(IllegalArgumentException e) {
        log.warn("[검증 오류] {}", e.getMessage());
        ErrorResponse error = new ErrorResponse(
            400, "VALIDATION_ERROR", e.getMessage(), LocalDateTime.now()
        );
        return ResponseEntity.status(400).body(error);
    }

    /** 인증 실패 (401) — 로그인 실패, 토큰 검증 실패 등 */
    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorized(UnauthorizedException e) {
        log.warn("[인증 실패] {}", e.getMessage());
        ErrorResponse error = new ErrorResponse(
            401, "UNAUTHORIZED", e.getMessage(), LocalDateTime.now()
        );
        return ResponseEntity.status(401).body(error);
    }

    /** 세션 없음 (404) */
    @ExceptionHandler(SessionNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleSessionNotFound(SessionNotFoundException e) {
        log.warn("[세션 없음] {}", e.getMessage());
        ErrorResponse error = new ErrorResponse(
            404, "SESSION_NOT_FOUND", e.getMessage(), LocalDateTime.now()
        );
        return ResponseEntity.status(404).body(error);
    }

    /** 상태 불일치 (409) — 잘못된 상태 전이 */
    @ExceptionHandler(InvalidStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidState(InvalidStateException e) {
        log.warn("[상태 불일치] {}", e.getMessage());
        ErrorResponse error = new ErrorResponse(
            409, "INVALID_STATE", e.getMessage(), LocalDateTime.now()
        );
        return ResponseEntity.status(409).body(error);
    }

    /** 리소스 충돌 (409) — 중복된 아이디 등 */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflict(ConflictException e) {
        log.warn("[리소스 충돌] {}", e.getMessage());
        ErrorResponse error = new ErrorResponse(
            409, "CONFLICT", e.getMessage(), LocalDateTime.now()
        );
        return ResponseEntity.status(409).body(error);
    }

    /** 예상하지 못한 서버 오류 (500) — catch-all */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAll(Exception e) {
        log.error("[서버 오류] {}", e.getMessage(), e);
        ErrorResponse error = new ErrorResponse(
            500, "INTERNAL_ERROR", "서버 내부 오류", LocalDateTime.now()
        );
        return ResponseEntity.status(500).body(error);
    }
}
