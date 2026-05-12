package com.capstone.interview.service;

import com.capstone.interview.config.LLMClient;
import com.capstone.interview.entity.Interview;
import com.capstone.interview.entity.InterviewQna;
import com.capstone.interview.repository.InterviewQnaRepository;
import com.capstone.interview.repository.InterviewRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluationService {

    private final InterviewRepository interviewRepository;
    private final InterviewQnaRepository interviewQnaRepository;
    private final LLMClient llmClient;
    private final ObjectMapper objectMapper;

    @Async
    @Transactional
    public void evaluate(String sessionId) {
        // 1. sessionId로 면접 조회
        Interview interview = interviewRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("면접 세션을 찾을 수 없습니다: " + sessionId));

        // 중복 평가 방지
        if (interview.getTotalFeedback() != null) {
            log.info("이미 평가 완료된 세션입니다: {}", sessionId);
            return;
        }

        // [방어 코드] 카테고리 정보가 없을 경우 처리
        if (interview.getCategory() == null) {
            log.warn("sessionId: {} 의 카테고리 정보가 없습니다. '일반'으로 진행합니다.", sessionId);
        }

        // 2. 해당 면접의 질문-답변 전체 조회
        List<InterviewQna> qnas = interviewQnaRepository
                .findByInterviewOrderBySequenceNumberAsc(interview);

        // ===== [TEST] 더미 QnA 생성 (실제 배포 시 이 블록 삭제하고 아래 원본 코드 주석 해제) =====
        if (qnas.isEmpty()) {
            log.info("[TEST] 질문-답변 데이터가 없어 더미 데이터를 생성합니다. sessionId: {}", sessionId);
            insertDummyQnas(interview);
            qnas = interviewQnaRepository.findByInterviewOrderBySequenceNumberAsc(interview);
        }
        
        // ===== [TEST] 여기까지 삭제 =====
        //[원본 코드] 실제 운영 시 아래 주석 해제
        //if (qnas.isEmpty()) {
        //    log.warn("질문-답변 데이터가 없습니다. sessionId: {}", sessionId);
        //    return;
        //}

        // 3. LLM에게 평가 요청
        String prompt = buildPrompt(interview, qnas);
        String llmResponse = llmClient.invoke(prompt);

        // 4. 응답 파싱 및 저장
        parseAndSave(llmResponse, qnas, interview);
    }

    private String buildPrompt(Interview interview, List<InterviewQna> qnas) {
        String category = (interview.getCategory() != null) ? interview.getCategory() : "일반 IT";
        StringBuilder sb = new StringBuilder();

        sb.append("""
                당신은 전문 면접관입니다.
                아래는 %s 직무 면접의 전체 질문-답변 목록입니다.
                각 질문의 유형을 [학습력/문제해결력/협업능력/기술역량/주도성/스트레스내성/직무적합성] 중 N개로 판단하고 평가해주세요.
                
                """.formatted(category));

        for (InterviewQna qna : qnas) {
            sb.append("[질문 %d] %s\n".formatted(qna.getSequenceNumber(), qna.getQuestionContent()));
            sb.append("[답변 %d] %s\n\n".formatted(
                    qna.getSequenceNumber(),
                    qna.getAnswerContent() != null ? qna.getAnswerContent() : "답변 없음"
            ));
        }

        sb.append("""
                아래 JSON 형식으로만 응답해주세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.
                
                {
                  "individual_feedbacks": [
                    {
                      "sequence_number": 1,
                      "question_type": "[학습력/문제해결력/협업능력/기술역량/주도성/스트레스내성/직무 적합성] 7가지 유형 중 N개",
                      "individual_feedback": "기술 정확도와 논리적 전달력 및 답변 구체성에 대한 평가 및 답변의 전반적인 강점/약점에 대해 3줄 이하로 서술.",
                      "model_answer": "3줄 이내의 모범 답안"
                    }
                  ],
                  "total_feedback": "나온 질문 유형들 중 강점 유형과 약점 유형을 언급하며, 1)잘한점 2)부족한점 3)개선방향을 포함하고, 준비도/전달력/지식불균형 분석과 핵심 학습 권고 3가지, 종합점수[상/중/하], 역량차트(나온 유형별 0~10점수)를 포함한 종합 피드백을 5줄 이하로 작성하세요.",
                  "competency_chart": {
                    "유형명": 점수
                  },
                  "overall_score": "상/중/하"
                }
                """);

        return sb.toString();
    }

    private void parseAndSave(String llmResponse, List<InterviewQna> qnas, Interview interview) {
        try {
            String cleanedResponse = extractJson(llmResponse);
            JsonNode root = objectMapper.readTree(cleanedResponse);

            Map<Integer, InterviewQna> qnaMap = qnas.stream()
                    .collect(Collectors.toMap(InterviewQna::getSequenceNumber, qna -> qna));

            // 1. 개별 피드백 저장
            List<InterviewQna> toUpdate = new ArrayList<>();
            JsonNode individualFeedbacks = root.path("individual_feedbacks");
            if (individualFeedbacks.isArray()) {
                for (JsonNode feedbackNode : individualFeedbacks) {
                    int seq = feedbackNode.path("sequence_number").asInt();
                    String modelAns = feedbackNode.path("model_answer").asText("");
                    String indFeedback = feedbackNode.path("individual_feedback").asText("");

                    InterviewQna qna = qnaMap.get(seq);
                    if (qna != null) {
                        qna.saveFeedback(modelAns, indFeedback);
                        toUpdate.add(qna);
                    }
                }
            }
            interviewQnaRepository.saveAll(toUpdate);

            // 2. 종합 피드백 가공 저장
            String totalFeedback = root.path("total_feedback").asText("피드백 정보가 없습니다.");
            String overallScore = root.path("overall_score").asText("N/A");
            String competencyChart = root.path("competency_chart").toString();

            // 프론트 전달용 구분자 포함하여 결합
            String combined = totalFeedback + "\n\n[SCORE]\n" + overallScore + "\n\n[CHART]\n" + competencyChart;

            interview.saveTotalFeedback(combined);
            interviewRepository.save(interview);

        } catch (Exception e) {
            log.error("파싱 실패. sessionId: {}, 응답 앞 200자: {}",
                    interview.getSessionId(),
                    (llmResponse != null && llmResponse.length() > 200) ? llmResponse.substring(0, 200) : llmResponse, e);
            interview.fail();
            interviewRepository.save(interview);
        }
    }

    private String extractJson(String llmResponse) {
        if (llmResponse == null) return "";
        String response = llmResponse.trim();
        if (response.startsWith("```")) {
            response = response
                    .replaceAll("^```json\\s*", "")
                    .replaceAll("^```\\s*", "")
                    .replaceAll("\\s*```$", "")
                    .trim();
        }
        return response;
    }

       
    /**
     * 테스트용: QnA 데이터가 없을 때 더미 질문-답변을 생성한다.
     * 실제 운영 시 제거할 것.
     */
    private void insertDummyQnas(Interview interview) {
        List<InterviewQna> dummies = List.of(
                InterviewQna.createDummy(interview, 1,
                        "Spring에서 DI(의존성 주입)란 무엇인가요?",
                        "객체가 필요한 의존성을 외부에서 주입받는 패턴입니다. Spring에서는 @Autowired나 생성자 주입을 통해 구현합니다.",
                        false),
                InterviewQna.createDummy(interview, 2,
                        "생성자 주입을 권장하는 이유는 무엇인가요?",
                        "생성자 주입은 final 키워드를 사용할 수 있어 불변성을 보장하고, 테스트 시 Mock 객체를 쉽게 주입할 수 있기 때문입니다.",
                        true),
                InterviewQna.createDummy(interview, 3,
                        "JPA에서 N+1 문제가 무엇이고 어떻게 해결하나요?",
                        "연관 엔티티를 지연 로딩할 때 추가 쿼리가 N번 발생하는 문제입니다. fetch join이나 @EntityGraph로 해결합니다.",
                        false)
        );
        interviewQnaRepository.saveAll(dummies);
    }
}
