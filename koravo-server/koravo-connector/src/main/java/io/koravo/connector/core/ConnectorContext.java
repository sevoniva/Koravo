package io.koravo.connector.core;

public record ConnectorContext(
        String tenantId,
        String userId,
        String requestId
) {
}
