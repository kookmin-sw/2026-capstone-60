package com.capstone.interview.exception;

/**
 * 리소스 충돌 예외 (HTTP 409).
 * 중복된 아이디, 중복된 리소스 생성 등에 사용.
 */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
