package com.capstone.interview.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * /internal/** 경로 전용 서비스 토큰 검증 필터.
 * Agent → Backend 서버 간 통신에 사용되는 공유 secret 헤더를 검증한다.
 */
@Slf4j
@Component
public class ServiceTokenFilter extends OncePerRequestFilter {

    private static final String SERVICE_TOKEN_HEADER = "X-Service-Token";

    @Value("${internal.service-token}")
    private String expectedToken;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // /internal/** 경로만 이 필터를 적용
        return !request.getRequestURI().startsWith("/internal/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = request.getHeader(SERVICE_TOKEN_HEADER);

        if (token == null || !token.equals(expectedToken)) {
            log.warn("[ServiceToken 검증 실패] URI={}, token={}", request.getRequestURI(),
                    token == null ? "null" : "invalid");
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                    "{\"status\":401,\"code\":\"UNAUTHORIZED\",\"message\":\"유효하지 않은 서비스 토큰입니다.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }
}
