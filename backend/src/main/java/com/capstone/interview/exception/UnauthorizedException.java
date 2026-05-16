package com.capstone.interview.exception;

/**
 * 인증 실패 예외 (HTTP 401).
 * 로그인 실패, 토큰 검증 실패 등에 사용.
 */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}
