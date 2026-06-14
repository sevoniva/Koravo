package io.koravo.ops.audit;

import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuditLogQueryServiceTest {
    private final AuditLogRepository repository = mock(AuditLogRepository.class);
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final AuditLogQueryService service = new AuditLogQueryService(repository, jdbcTemplate);

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

        var result = service.query("admin", "PROCESS_MODEL_DEPLOY", "PROCESS_MODEL", "model-1", "req-1", null, null, 1, 20);

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().getFirst().action()).isEqualTo("PROCESS_MODEL_DEPLOY");
        assertThat(result.items().getFirst().requestId()).isEqualTo("req-1");
        assertThat(result.items().getFirst().detailJson()).doesNotContain("password");
    }

    @Test
    void relatedResourcePatternEscapesLikeWildcards() {
        assertThat(service.relatedResourcePattern("pi_1%2\\3"))
                .isEqualTo("%pi\\_1\\%2\\\\3%");
    }

    @Test
    void relatedTaskIdsReadsTaskIdsFromFormSnapshots() {
        TenantContextHolder.setTenantId("default");
        when(jdbcTemplate.queryForList(any(String.class), eq(String.class), any(), any()))
                .thenReturn(List.of("task-1", "task-2"));

        assertThat(service.relatedTaskIds("pi-1")).containsExactly("task-1", "task-2");
    }

    @Test
    void hiddenAuditPatternsCoverVerificationRunsAndNonProductionAssets() {
        assertThat(service.hiddenAuditLikePatterns())
                .contains(
                        "COLLAB-VERIFY-%",
                        "%COLLAB-VERIFY-%",
                        "EA-%",
                        "%\"assetOrigin\":\"TEST_FIXTURE\"%",
                        "%\"assetOrigin\":\"LEGACY_DEMO\"%"
                );
    }
}
