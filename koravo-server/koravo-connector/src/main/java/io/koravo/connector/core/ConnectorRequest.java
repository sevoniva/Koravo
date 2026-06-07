package io.koravo.connector.core;

import java.time.Duration;
import java.util.Map;

public record ConnectorRequest(
        String method,
        String url,
        Map<String, String> headers,
        String body,
        Duration timeout
) {
}
