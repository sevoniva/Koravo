package io.koravo.engine.dto;

import java.time.Instant;

public record TaskCommentDTO(
        String id,
        String userId,
        String message,
        Instant time
) {
}
