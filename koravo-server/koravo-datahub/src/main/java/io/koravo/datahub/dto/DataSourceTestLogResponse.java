package io.koravo.datahub.dto;

import java.time.Instant;

public record DataSourceTestLogResponse(
        String id,
        String datasourceId,
        boolean success,
        String message,
        long elapsedMillis,
        Instant createdAt
) {
}
