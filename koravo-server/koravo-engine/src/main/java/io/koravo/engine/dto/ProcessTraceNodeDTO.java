package io.koravo.engine.dto;

import java.time.Instant;

public record ProcessTraceNodeDTO(
        String activityId,
        String activityName,
        String activityType,
        Instant startTime,
        Instant endTime,
        String status
) {
}
