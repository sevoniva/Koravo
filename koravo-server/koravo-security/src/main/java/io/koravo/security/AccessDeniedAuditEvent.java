package io.koravo.security;

public record AccessDeniedAuditEvent(
        String method,
        String path,
        String userId,
        String role
) {
}
