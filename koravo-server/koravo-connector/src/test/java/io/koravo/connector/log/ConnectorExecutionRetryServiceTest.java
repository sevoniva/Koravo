package io.koravo.connector.log;

import io.koravo.common.exception.BusinessException;
import io.koravo.connector.core.Connector;
import io.koravo.connector.core.ConnectorContext;
import io.koravo.connector.core.ConnectorRegistry;
import io.koravo.connector.core.ConnectorRequest;
import io.koravo.connector.core.ConnectorResponse;
import io.koravo.connector.domain.KoConnectorExecutionLog;
import io.koravo.connector.repo.ConnectorExecutionLogRepository;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ConnectorExecutionRetryServiceTest {
    private final ConnectorExecutionLogRepository repository = mock(ConnectorExecutionLogRepository.class);
    private final ConnectorExecutionLogService logService = mock(ConnectorExecutionLogService.class);
    private final TestConnector connector = new TestConnector();
    private final ConnectorExecutionRetryService service = new ConnectorExecutionRetryService(
            repository,
            new ConnectorRegistry(List.of(connector)),
            logService
    );

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void retryExecutesFailedLogAndRecordsSuccess() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUser("operator", "operator");
        KoConnectorExecutionLog source = failedLog();
        KoConnectorExecutionLog saved = new KoConnectorExecutionLog();
        saved.setId("retry-log-1");
        saved.setStatus("SUCCESS");
        when(repository.findByIdAndTenantId("log-1", "default")).thenReturn(Optional.of(source));
        when(logService.recordSuccess(eq("http"), any(), any(), any(), anyLong())).thenReturn(saved);

        KoConnectorExecutionLog result = service.retry("log-1");

        assertThat(result.getId()).isEqualTo("retry-log-1");
        assertThat(connector.request.method()).isEqualTo("POST");
        assertThat(connector.request.url()).isEqualTo("https://example.com/hook");
        assertThat(connector.request.body()).isEqualTo("{\"ok\":true}");
        verify(logService).recordSuccess(eq("http"), any(ConnectorContext.class), any(ConnectorRequest.class), any(ConnectorResponse.class), anyLong());
    }

    @Test
    void retryRejectsNonFailedLog() {
        TenantContextHolder.setTenantId("default");
        KoConnectorExecutionLog source = failedLog();
        source.setStatus("SUCCESS");
        when(repository.findByIdAndTenantId("log-1", "default")).thenReturn(Optional.of(source));

        assertThatThrownBy(() -> service.retry("log-1"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("仅失败记录可重试");
    }

    @Test
    void retryRecordsFailureWhenConnectorStillFails() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUser("operator", "operator");
        connector.error = new BusinessException(io.koravo.common.exception.ErrorCode.BAD_REQUEST, "still failed");
        KoConnectorExecutionLog source = failedLog();
        when(repository.findByIdAndTenantId("log-1", "default")).thenReturn(Optional.of(source));

        assertThatThrownBy(() -> service.retry("log-1"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("still failed");

        verify(logService).recordFailure(eq("http"), any(ConnectorContext.class), any(ConnectorRequest.class), eq(connector.error), anyLong());
    }

    private KoConnectorExecutionLog failedLog() {
        KoConnectorExecutionLog log = new KoConnectorExecutionLog();
        log.setId("log-1");
        log.setTenantId("default");
        log.setConnectorType("http");
        log.setMethod("POST");
        log.setUrl("https://example.com/hook");
        log.setStatus("FAILED");
        log.setElapsedMillis(20);
        log.setRequestId("req-1");
        log.setRequestSummary("method=POST, url=https://example.com/hook, headers={}, body={\"ok\":true}");
        return log;
    }

    private static class TestConnector implements Connector {
        private ConnectorRequest request;
        private RuntimeException error;

        @Override
        public String type() {
            return "http";
        }

        @Override
        public ConnectorResponse execute(ConnectorRequest request, ConnectorContext context) {
            this.request = request;
            if (error != null) {
                throw error;
            }
            return new ConnectorResponse(200, Map.of(), "ok");
        }
    }
}
