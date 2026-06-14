package io.koravo.connector.log;

import io.koravo.connector.domain.KoConnectorExecutionLog;
import io.koravo.connector.repo.ConnectorExecutionLogRepository;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConnectorExecutionLogQueryServiceTest {
    private final ConnectorExecutionLogRepository repository = mock(ConnectorExecutionLogRepository.class);
    private final ConnectorExecutionLogQueryService service = new ConnectorExecutionLogQueryService(repository);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @SuppressWarnings("unchecked")
    void queryReturnsTenantScopedRedactedLogs() {
        TenantContextHolder.setTenantId("default");
        KoConnectorExecutionLog log = new KoConnectorExecutionLog();
        log.setId("log-1");
        log.setTenantId("default");
        log.setConnectorType("http");
        log.setMethod("POST");
        log.setUrl("https://api.example.com/hook?token=abc");
        log.setStatus("SUCCESS");
        log.setStatusCode(200);
        log.setElapsedMillis(42);
        log.setRequestId("req-1");
        log.setRequestSummary("body={\"password\":\"secret\"}");
        log.setResponseSummary("statusCode=200");
        log.setCreatedAt(Instant.parse("2026-06-07T00:00:00Z"));
        when(repository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(new PageImpl<>(List.of(log)));

        var result = service.query("http", "SUCCESS", "req-1", 1, 20);

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items().getFirst().connectorType()).isEqualTo("http");
        assertThat(result.items().getFirst().requestId()).isEqualTo("req-1");
        assertThat(result.items().getFirst().url()).doesNotContain("abc");
        assertThat(result.items().getFirst().requestSummary()).doesNotContain("secret");
    }

    @Test
    @SuppressWarnings("unchecked")
    void summaryReturnsCountsAndRecentFailures() {
        TenantContextHolder.setTenantId("default");
        KoConnectorExecutionLog failed = new KoConnectorExecutionLog();
        failed.setId("log-failed");
        failed.setTenantId("default");
        failed.setConnectorType("http");
        failed.setStatus("FAILED");
        failed.setElapsedMillis(12);
        failed.setErrorMessage("timeout");
        failed.setCreatedAt(Instant.parse("2026-06-07T01:00:00Z"));
        when(repository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(page(List.of(), 12))
                .thenReturn(page(List.of(), 9))
                .thenReturn(page(List.of(failed), 3));

        var result = service.summary("http");

        assertThat(result.total()).isEqualTo(12);
        assertThat(result.success()).isEqualTo(9);
        assertThat(result.failed()).isEqualTo(3);
        assertThat(result.recentFailures()).hasSize(1);
        assertThat(result.recentFailures().getFirst().errorMessage()).isEqualTo("timeout");
    }

    private Page<KoConnectorExecutionLog> page(List<KoConnectorExecutionLog> logs, long total) {
        return new PageImpl<>(logs, Pageable.ofSize(Math.max(1, logs.size())), total);
    }
}
