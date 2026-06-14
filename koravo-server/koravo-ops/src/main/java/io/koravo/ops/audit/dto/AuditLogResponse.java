package io.koravo.ops.audit.dto;

import java.time.Instant;

public record AuditLogResponse(
        String id,
        String tenantId,
        String userId,
        String action,
        String resourceType,
        String resourceId,
        String requestId,
        String clientIp,
        String detailJson,
        Instant createdAt
) {
}
