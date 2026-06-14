package io.koravo.ops.dto;

import java.util.List;

public record OpsSummaryResponse(
        long runningInstanceCount,
        long failedJobCount,
        long deadLetterJobCount,
        long connectorFailureCount,
        List<OpsSummaryItem> exceptions
) {
    public record OpsSummaryItem(
            String key,
            String name,
            String status,
            long count,
            String message
    ) {
    }
}
