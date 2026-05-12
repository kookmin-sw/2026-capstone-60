package com.capstone.interview.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.livekit.server.AccessToken;
import io.livekit.server.RoomAdmin;
import io.livekit.server.RoomName;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Base64;
import java.util.Map;

/**
 * LiveKit Room 관리 서비스.
 * Twirp HTTP API 를 사용하여 Data Message 전송 및 Room 삭제를 수행한다.
 */
@Slf4j
@Service
public class LiveKitRoomService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String apiSecret;

    public LiveKitRoomService(
            @Value("${livekit.url}") String livekitUrl,
            @Value("${livekit.api-key}") String apiKey,
            @Value("${livekit.api-secret}") String apiSecret,
            ObjectMapper objectMapper) {
        String httpUrl = livekitUrl.replace("wss://", "https://").replace("ws://", "http://");
        this.restClient = RestClient.builder().baseUrl(httpUrl).build();
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
    }

    /**
     * Room 에 Data Message 를 전송한다.
     * 실패 시 RuntimeException 을 던진다.
     */
    public void sendData(String roomName, Map<String, Object> message) {
        try {
            String token = generateRoomAdminToken(roomName);
            String messageJson = objectMapper.writeValueAsString(message);
            String dataBase64 = Base64.getEncoder().encodeToString(messageJson.getBytes());

            Map<String, Object> requestBody = Map.of(
                    "room", roomName,
                    "data", dataBase64,
                    "kind", "RELIABLE"
            );

            restClient.post()
                    .uri("/twirp/livekit.RoomService/SendData")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(objectMapper.writeValueAsString(requestBody))
                    .retrieve()
                    .toBodilessEntity();

            log.info("[SendData 성공] room={}", roomName);
        } catch (Exception e) {
            log.error("[SendData 실패] room={}, error={}", roomName, e.getMessage(), e);
            throw new RuntimeException("Data Message 전송 실패: " + e.getMessage(), e);
        }
    }

    /**
     * Room 을 삭제한다. Agent 강제 연결 종료 용도.
     * 실패해도 예외를 던지지 않고 로그만 남긴다.
     */
    public void deleteRoom(String roomName) {
        try {
            String token = generateRoomAdminToken(roomName);

            Map<String, String> requestBody = Map.of("room", roomName);

            restClient.post()
                    .uri("/twirp/livekit.RoomService/DeleteRoom")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(objectMapper.writeValueAsString(requestBody))
                    .retrieve()
                    .toBodilessEntity();

            log.info("[DeleteRoom 성공] room={}", roomName);
        } catch (Exception e) {
            log.warn("[DeleteRoom 실패] room={}, error={} — 무시하고 계속 진행", roomName, e.getMessage());
        }
    }

    private String generateRoomAdminToken(String roomName) {
        AccessToken token = new AccessToken(apiKey, apiSecret);
        token.setName("backend-service");
        token.setIdentity("backend-service");
        token.addGrants(new RoomAdmin(true), new RoomName(roomName));
        return token.toJwt();
    }
}
