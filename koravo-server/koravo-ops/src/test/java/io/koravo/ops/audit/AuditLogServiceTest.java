package io.koravo.ops.audit;

import io.koravo.common.web.RequestContextHolder;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AuditLogServiceTest {
    private final AuditLogRepository repository = mock(AuditLogRepository.class);
    private final AuditLogService service = new AuditLogService(repository);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
        RequestContextHolder.clear();
    }

    @Test
    void recordRedactsSensitiveDetailBeforePersisting() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        RequestContextHolder.set("req-1", "127.0.0.1");

        service.record("TEST", "RESOURCE", "res-1", Map.of(
                "password", "plain-password",
                "token", "plain-token",
                "nested", Map.of("secret", "plain-secret"),
                "name", "safe"
        ));

        ArgumentCaptor<AuditLog> captor = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(captor.capture());
        AuditLog saved = captor.getValue();

        assertThat(saved.getTenantId()).isEqualTo("default");
        assertThat(saved.getUserId()).isEqualTo("admin");
        assertThat(saved.getRequestId()).isEqualTo("req-1");
        assertThat(saved.getClientIp()).isEqualTo("127.0.0.1");
        assertThat(saved.getDetailJson()).contains("\"password\":\"******\"");
        assertThat(saved.getDetailJson()).contains("\"token\":\"******\"");
        assertThat(saved.getDetailJson()).contains("\"secret\":\"******\"");
        assertThat(saved.getDetailJson()).contains("\"name\":\"safe\"");
        assertThat(saved.getDetailJson()).doesNotContain("plain-password", "plain-token", "plain-secret");
    }
}
