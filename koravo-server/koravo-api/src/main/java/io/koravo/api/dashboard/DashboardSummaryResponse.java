package io.koravo.api.dashboard;

import io.koravo.connector.log.ConnectorExecutionSummaryResponse;
import io.koravo.ops.audit.dto.AuditLogResponse;

import java.time.Instant;
import java.util.List;

public record DashboardSummaryResponse(
        String tenantId,
        String userId,
        String healthStatus,
        String version,
        Instant time,
        long processModelCount,
        long deployedProcessModelCount,
        long runningInstanceCount,
        long myTodoCount,
        long todayCompletedCount,
        long connectorSuccessCount,
        long connectorFailedCount,
        long failedJobCount,
        long deadLetterJobCount,
        List<AuditLogResponse> recentAuditLogs,
        ConnectorExecutionSummaryResponse connectorSummary
) {
}
