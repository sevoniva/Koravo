package io.koravo.connector.log;

import java.util.List;

public record ConnectorExecutionSummaryResponse(
        long total,
        long success,
        long failed,
        List<ConnectorExecutionLogResponse> recentFailures
) {
}
