package com.capstone.interview.config;

import org.springframework.stereotype.Component;
import java.util.List;

/**
 * Bedrock 키 없을 때 테스트용 가짜 LLM 클라이언트
 * 실제 Bedrock 연동 시 BedrockLLMClient로 교체
 */
@Component
public class MockLLMClient implements LLMClient {

    @Override
    public String invoke(String prompt) {
        return """
            {
              "individual_feedbacks": [
                {
                  "sequence_number": 1,
                  "question_type": "기술역량",
                  "individual_feedback": "DI 개념을 정확히 이해하고 있으며, @Autowired와 생성자 주입을 언급한 점이 좋습니다. 다만 DI 컨테이너의 동작 원리까지 설명했으면 더 좋았을 것입니다.",
                  "model_answer": "의존성 주입(DI)은 객체가 필요로 하는 의존 객체를 직접 생성하지 않고, 외부(스프링 컨테이너)에서 생성하여 주입해주는 디자인 패턴입니다. 이를 통해 결합도를 낮추고 테스트 용이성을 높일 수 있습니다. Spring에서는 @Autowired, 생성자 주입, setter 주입 방식을 지원합니다."
                },
                {
                  "sequence_number": 2,
                  "question_type": "기술역량",
                  "individual_feedback": "생성자 주입의 불변성과 테스트 용이성을 정확히 짚었습니다. 필드 주입의 순환 참조 문제나 Spring 팀의 공식 권장 사항까지 언급하면 더 완성도 높은 답변이 됩니다.",
                  "model_answer": "생성자 주입은 final 필드를 사용하여 불변성을 보장하고, 의존성이 명시적이어서 테스트 시 Mock 객체를 쉽게 주입할 수 있습니다. 필드 주입은 코드가 간결하지만 리플렉션에 의존하고, 순환 참조를 컴파일 타임에 감지할 수 없습니다. Spring 공식 문서에서도 생성자 주입을 권장합니다."
                },
                {
                  "sequence_number": 3,
                  "question_type": "문제해결력",
                  "individual_feedback": "fetch join과 @EntityGraph를 정확히 언급했습니다. 추가로 Batch Size 설정이나 DTO 프로젝션 등 상황별 해결 전략을 비교 설명하면 더 깊이 있는 답변이 됩니다.",
                  "model_answer": "N+1 문제는 연관 엔티티를 지연 로딩할 때 추가 쿼리가 N번 발생하는 현상입니다. 해결 방법으로는 (1) JPQL fetch join으로 한 번에 조회, (2) @EntityGraph로 연관 엔티티 즉시 로딩, (3) hibernate.default_batch_fetch_size 설정으로 IN 절 배치 처리, (4) DTO 프로젝션으로 필요한 데이터만 조회하는 방법이 있습니다."
                }
              ],
              "total_feedback": "전반적으로 Spring 핵심 개념에 대한 이해도가 높은 면접이었습니다. DI와 JPA 관련 질문에 핵심을 정확히 짚었으며, 실무 경험이 반영된 답변이 인상적입니다. 1)잘한점: 기술 개념의 핵심을 간결하게 전달하는 능력이 우수합니다. 2)부족한점: 답변의 깊이가 다소 얕아 심화 내용이 부족합니다. 3)개선방향: 각 기술의 내부 동작 원리와 트레이드오프를 학습하여 Why까지 설명할 수 있도록 준비하세요.",
              "competency_chart": {
                "기술역량": 8,
                "문제해결력": 7,
                "학습력": 6
              },
              "overall_score": "중"
            }
            """;
    }

    @Override
    public List<Float> embed(String text) {
        return List.of(0.1f, 0.2f, 0.3f);
    }
}