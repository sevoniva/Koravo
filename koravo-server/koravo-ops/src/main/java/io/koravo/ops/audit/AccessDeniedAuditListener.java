package io.koravo.ops.audit;

import io.koravo.security.AccessDeniedAuditEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class AccessDeniedAuditListener {
    private static final int RESOURCE_ID_LIMIT = 128;
    private static final Logger log = LoggerFactory.getLogger(AccessDeniedAuditListener.class);

    private final AuditLogService auditLogService;

    public AccessDeniedAuditListener(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    @EventListener
    public void onAccessDenied(AccessDeniedAuditEvent event) {
        try {
            auditLogService.record("ACCESS_DENIED", "API_ENDPOINT", resourceId(event), Map.of(
                    "method", event.method(),
                    "path", event.path(),
                    "userId", event.userId(),
                    "role", event.role(),
                    "reason", "ROLE_PERMISSION_DENIED"
            ));
        } catch (RuntimeException ex) {
            log.warn("Failed to record access denied audit for {} {}", event.method(), event.path(), ex);
        }
    }

    private String resourceId(AccessDeniedAuditEvent event) {
        String id = event.method() + " " + event.path();
        return id.length() <= RESOURCE_ID_LIMIT ? id : id.substring(0, RESOURCE_ID_LIMIT);
    }
}
