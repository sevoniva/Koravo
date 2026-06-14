package io.koravo.connector.log;

import java.time.Instant;

public record ConnectorExecutionLogResponse(
        String id,
        String connectorType,
        String method,
        String url,
        String status,
        Integer statusCode,
        long elapsedMillis,
        String requestId,
        String requestSummary,
        String responseSummary,
        String errorMessage,
        Instant createdAt
) {
}
