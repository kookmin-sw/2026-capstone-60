-- 테스트용 더미 데이터 (앱 시작 시 자동 실행)
-- 이미 데이터가 있으면 무시하도록 ON CONFLICT 사용

-- 1. 테스트 회원 (password: pw1234를 BCrypt로 인코딩한 값)
INSERT INTO members (login_id, password, name, created_at, updated_at)
VALUES ('test1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '테스터', NOW(), NOW())
ON CONFLICT (login_id) DO NOTHING;

-- 2. 테스트 면접 세션
INSERT INTO interviews (session_id, member_id, category, status, created_at, updated_at)
SELECT 'sess-test-0001', m.id, 'BACKEND', 'IN_PROGRESS', NOW(), NOW()
FROM members m WHERE m.login_id = 'test1'
AND NOT EXISTS (SELECT 1 FROM interviews WHERE session_id = 'sess-test-0001');

-- 3. 테스트 질문-답변 데이터
INSERT INTO interview_qnas (interview_id, sequence_number, question_content, answer_content, is_follow_up, created_at, updated_at)
SELECT i.id, 1, 'Spring Boot에서 의존성 주입(DI)이란 무엇인가요?',
       '객체를 직접 생성하지 않고 외부에서 주입받는 패턴입니다. @Autowired나 생성자 주입을 사용합니다.',
       false, NOW(), NOW()
FROM interviews i WHERE i.session_id = 'sess-test-0001'
AND NOT EXISTS (SELECT 1 FROM interview_qnas iq JOIN interviews iv ON iq.interview_id = iv.id WHERE iv.session_id = 'sess-test-0001' AND iq.sequence_number = 1);

INSERT INTO interview_qnas (interview_id, sequence_number, question_content, answer_content, is_follow_up, created_at, updated_at)
SELECT i.id, 2, '생성자 주입과 필드 주입의 차이점은 무엇인가요?',
       '생성자 주입은 불변성을 보장하고 테스트가 쉽습니다. 필드 주입은 간편하지만 테스트 시 리플렉션이 필요합니다.',
       true, NOW(), NOW()
FROM interviews i WHERE i.session_id = 'sess-test-0001'
AND NOT EXISTS (SELECT 1 FROM interview_qnas iq JOIN interviews iv ON iq.interview_id = iv.id WHERE iv.session_id = 'sess-test-0001' AND iq.sequence_number = 2);

INSERT INTO interview_qnas (interview_id, sequence_number, question_content, answer_content, is_follow_up, created_at, updated_at)
SELECT i.id, 3, 'JPA의 N+1 문제를 어떻게 해결하나요?',
       'fetch join이나 @EntityGraph를 사용하여 연관 엔티티를 한 번에 조회합니다.',
       false, NOW(), NOW()
FROM interviews i WHERE i.session_id = 'sess-test-0001'
AND NOT EXISTS (SELECT 1 FROM interview_qnas iq JOIN interviews iv ON iq.interview_id = iv.id WHERE iv.session_id = 'sess-test-0001' AND iq.sequence_number = 3);
