package io.koravo.ops.audit;

import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuditLogQueryServiceTest {
    private final AuditLogRepository repository = mock(AuditLogRepository.class);
    private final AuditLogQueryService service = new AuditLogQueryService(repository);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void queryReturnsPagedAuditLogResponsesWithoutSecrets() {
        TenantContextHolder.setTenantId("default");
        AuditLog log = new AuditLog();
        log.setId("audit-1");
        log.setTenantId("default");
        log.setUserId("admin");
        log.setAction("PROCESS_MODEL_DEPLOY");
        log.setResourceType("PROCESS_MODEL");
        log.setResourceId("model-1");
        log.setRequestId("req-1");
        log.setClientIp("127.0.0.1");
        log.setDetailJson("{\"modelKey\":\"leaveApproval\"}");
        log.setCreatedAt(Instant.parse("2026-06-07T00:00:00Z"));
        when(repository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(log)));

        var result = service.query("admin", "PROCESS_MODEL_DEPLOY", "PROCESS_MODEL", null, null, 1, 20);

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().getFirst().action()).isEqualTo("PROCESS_MODEL_DEPLOY");
        assertThat(result.items().getFirst().detailJson()).doesNotContain("password");
    }
}
