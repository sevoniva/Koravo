package io.koravo.connector.log;

import io.koravo.connector.core.ConnectorContext;
import io.koravo.connector.core.ConnectorRequest;
import io.koravo.connector.core.ConnectorResponse;
import io.koravo.connector.domain.KoConnectorExecutionLog;
import io.koravo.connector.repo.ConnectorExecutionLogRepository;
import io.koravo.ops.audit.AuditLogService;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ConnectorExecutionLogServiceTest {
    private final ConnectorExecutionLogRepository repository = mock(ConnectorExecutionLogRepository.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final ConnectorExecutionLogService service = new ConnectorExecutionLogService(repository, auditLogService);

    @Test
    void recordSuccessRedactsSensitiveRequestData() {
        when(repository.save(any(KoConnectorExecutionLog.class))).thenAnswer(invocation -> {
            KoConnectorExecutionLog log = invocation.getArgument(0);
            log.setId("connector-log-1");
            return log;
        });

        KoConnectorExecutionLog log = service.recordSuccess(
                "http",
                new ConnectorContext("default", "admin", "req-1"),
                new ConnectorRequest(
                        "POST",
                        "https://api.example.com/hook?token=abc",
                        Map.of("Authorization", "Bearer secret"),
                        "{\"password\":\"secret\"}",
                        Duration.ofSeconds(2)
                ),
                new ConnectorResponse(200, Map.of("content-type", List.of("application/json")), "{\"ok\":true}"),
                31
        );

        assertThat(log.getTenantId()).isEqualTo("default");
        assertThat(log.getStatus()).isEqualTo("SUCCESS");
        assertThat(log.getRequestSummary()).doesNotContain("abc", "secret");
        assertThat(log.getResponseSummary()).contains("statusCode=200");
        verify(auditLogService).record("CONNECTOR_EXECUTE", "CONNECTOR_EXECUTION", "connector-log-1", Map.of(
                "connectorType", "http",
                "status", "SUCCESS",
                "statusCode", 200,
                "requestId", "req-1",
                "elapsedMillis", 31L
        ));
    }
}
