package com.capstone.interview.service;

import com.capstone.interview.config.JwtProvider;
import com.capstone.interview.dto.LoginRequest;
import com.capstone.interview.dto.LoginResponse;
import com.capstone.interview.dto.SignupRequest;
import com.capstone.interview.dto.SignupResponse;
import com.capstone.interview.entity.Member;
import com.capstone.interview.exception.ConflictException;
import com.capstone.interview.exception.UnauthorizedException;
import com.capstone.interview.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    @Value("${jwt.expiration}")
    private long expirationMs;

    /**
     * 회원가입.
     * loginId 중복 시 ConflictException (409).
     */
    @Transactional
    public SignupResponse signup(SignupRequest request) {
        validateSignupRequest(request);

        if (memberRepository.existsByLoginId(request.loginId())) {
            throw new ConflictException("이미 사용 중인 아이디입니다.");
        }

        Member member = Member.builder()
                .loginId(request.loginId())
                .password(passwordEncoder.encode(request.password()))
                .name(request.name())
                .build();

        Member saved = memberRepository.save(member);

        return new SignupResponse(
                true,
                new SignupResponse.Data(saved.getId(), saved.getLoginId(), saved.getName())
        );
    }

    /**
     * 로그인.
     * 아이디 없음/비밀번호 불일치 시 UnauthorizedException (401).
     */
    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        validateLoginRequest(request);

        Member member = memberRepository.findByLoginId(request.loginId())
                .orElseThrow(() -> new UnauthorizedException("아이디 또는 비밀번호가 올바르지 않습니다."));

        if (!passwordEncoder.matches(request.password(), member.getPassword())) {
            throw new UnauthorizedException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        String accessToken = jwtProvider.createToken(member.getLoginId());

        return new LoginResponse(
                true,
                new LoginResponse.Data(accessToken, "Bearer", expirationMs / 1000)
        );
    }

    private void validateSignupRequest(SignupRequest request) {
        if (isBlank(request.loginId())) {
            throw new IllegalArgumentException("loginId는 필수입니다.");
        }
        if (isBlank(request.password())) {
            throw new IllegalArgumentException("password는 필수입니다.");
        }
        if (isBlank(request.name())) {
            throw new IllegalArgumentException("name은 필수입니다.");
        }
    }

    private void validateLoginRequest(LoginRequest request) {
        if (isBlank(request.loginId())) {
            throw new IllegalArgumentException("loginId는 필수입니다.");
        }
        if (isBlank(request.password())) {
            throw new IllegalArgumentException("password는 필수입니다.");
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
