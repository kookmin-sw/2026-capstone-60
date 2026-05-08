package com.capstone.interview.controller;

import com.capstone.interview.dto.LoginRequest;
import com.capstone.interview.dto.LoginResponse;
import com.capstone.interview.dto.MemberDeleteRequest;
import com.capstone.interview.dto.MemberDeleteResponse;
import com.capstone.interview.dto.MemberInfoResponse;
import com.capstone.interview.dto.MemberUpdateRequest;
import com.capstone.interview.dto.MemberUpdateResponse;
import com.capstone.interview.dto.SignupRequest;
import com.capstone.interview.dto.SignupResponse;
import com.capstone.interview.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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

    @GetMapping("/me")
    public ResponseEntity<MemberInfoResponse> getMyInfo(Authentication authentication) {
        String loginId = authentication.getName();
        log.info("[내 정보 조회] loginId={}", loginId);
        return ResponseEntity.ok(authService.getMyInfo(loginId));
    }

    @PutMapping("/me")
    public ResponseEntity<MemberUpdateResponse> updateMember(Authentication authentication,
                                                              @RequestBody MemberUpdateRequest request) {
        String loginId = authentication.getName();
        log.info("[회원 정보 수정] loginId={}", loginId);
        return ResponseEntity.ok(authService.updateMember(loginId, request));
    }

    @DeleteMapping("/me")
    public ResponseEntity<MemberDeleteResponse> deleteMember(Authentication authentication,
                                                              @RequestBody MemberDeleteRequest request) {
        String loginId = authentication.getName();
        log.info("[회원 탈퇴 요청] loginId={}", loginId);
        MemberDeleteResponse response = authService.deleteMember(loginId, request);
        log.info("[회원 탈퇴 완료] loginId={}", loginId);
        return ResponseEntity.ok(response);
    }
}
