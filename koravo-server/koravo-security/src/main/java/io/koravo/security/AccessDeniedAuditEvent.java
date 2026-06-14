package io.koravo.security;

public record AccessDeniedAuditEvent(
        String method,
        String path,
        String userId,
        String role,
        String tenantId,
        String requestId,
        String clientIp
) {
    public AccessDeniedAuditEvent(String method, String path, String userId, String role) {
        this(method, path, userId, role, "default", null, null);
    }
}
