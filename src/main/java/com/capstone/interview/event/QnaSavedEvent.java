package com.capstone.interview.event;

public record QnaSavedEvent(
        String sessionId,
        Integer turnNumber
) {
}
