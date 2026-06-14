package io.koravo.ops.audit;

import io.koravo.security.AccessDeniedAuditEvent;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AccessDeniedAuditListenerTest {
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final AccessDeniedAuditListener listener = new AccessDeniedAuditListener(auditLogService);

    @Test
    @SuppressWarnings("unchecked")
    void recordsDeniedApiAccessAsAuditLog() {
        listener.onAccessDenied(new AccessDeniedAuditEvent(
                "POST",
                "/api/v1/process-models",
                "starter",
                "applicant"
        ));

        ArgumentCaptor<Map<String, Object>> detailCaptor = ArgumentCaptor.forClass(Map.class);
        verify(auditLogService).record(
                eq("ACCESS_DENIED"),
                eq("API_ENDPOINT"),
                eq("POST /api/v1/process-models"),
                detailCaptor.capture()
        );
        assertThat(detailCaptor.getValue()).containsEntry("method", "POST");
        assertThat(detailCaptor.getValue()).containsEntry("path", "/api/v1/process-models");
        assertThat(detailCaptor.getValue()).containsEntry("userId", "starter");
        assertThat(detailCaptor.getValue()).containsEntry("role", "applicant");
        assertThat(detailCaptor.getValue()).containsEntry("reason", "ROLE_PERMISSION_DENIED");
    }
}
