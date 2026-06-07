package io.koravo.connector.core;

import java.util.List;
import java.util.Map;

public record ConnectorResponse(
        int statusCode,
        Map<String, List<String>> headers,
        String body
) {
}
