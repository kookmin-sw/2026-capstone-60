package com.capstone.interview.controller;

import com.capstone.interview.dto.LoginRequest;
import com.capstone.interview.dto.LoginResponse;
import com.capstone.interview.dto.SignupRequest;
import com.capstone.interview.dto.SignupResponse;
import com.capstone.interview.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<SignupResponse> signup(@RequestBody SignupRequest request) {
        log.info("[회원가입 요청] loginId={}, name={}", request.loginId(), request.name());

        SignupResponse response = authService.signup(request);
        log.info("[회원가입 성공] id={}, loginId={}", response.data().id(), response.data().loginId());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        log.info("[로그인 요청] loginId={}", request.loginId());

        LoginResponse response = authService.login(request);
        log.info("[로그인 성공] loginId={}", request.loginId());
        return ResponseEntity.ok(response);
    }
}
