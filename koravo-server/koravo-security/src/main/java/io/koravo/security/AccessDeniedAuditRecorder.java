package io.koravo.security;

public interface AccessDeniedAuditRecorder {
    void recordAccessDenied(AccessDeniedAuditEvent event);
}
