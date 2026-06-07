package io.koravo.connector.flowable;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.koravo.connector.core.Connector;
import io.koravo.connector.core.ConnectorContext;
import io.koravo.connector.core.ConnectorRegistry;
import io.koravo.connector.core.ConnectorRequest;
import io.koravo.connector.core.ConnectorResponse;
import io.koravo.connector.log.ConnectorExecutionLogService;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KoravoConnectorDelegateTest {
    @Test
    void executesConfiguredConnectorAndWritesOutputVariable() {
        Connector connector = mock(Connector.class);
        when(connector.type()).thenReturn("http");
        when(connector.execute(any(ConnectorRequest.class), any(ConnectorContext.class)))
                .thenReturn(new ConnectorResponse(200, Map.of("content-type", List.of("application/json")), "{\"ok\":true}"));
        ConnectorExecutionLogService logService = mock(ConnectorExecutionLogService.class);
        KoravoConnectorDelegate delegate = new KoravoConnectorDelegate(new ConnectorRegistry(List.of(connector)), new ObjectMapper(), logService);
        delegate.setConnectorType(expression("http"));
        delegate.setUrl(expression("http://localhost:8080/echo"));
        delegate.setMethod(expression("POST"));
        delegate.setHeaders(expression("{\"X-Test\":\"koravo\"}"));
        delegate.setBody(expression("{\"ping\":true}"));
        delegate.setOutputVariable(expression("connectorResult"));
        delegate.setTimeoutMillis(expression("2000"));
        DelegateExecution execution = mock(DelegateExecution.class);
        when(execution.getTenantId()).thenReturn("default");
        when(execution.getVariable("startUserId")).thenReturn("admin");
        when(execution.getVariable("requestId")).thenReturn("req-1");

        delegate.execute(execution);

        verify(connector).execute(eq(new ConnectorRequest(
                "POST",
                "http://localhost:8080/echo",
                Map.of("X-Test", "koravo"),
                "{\"ping\":true}",
                Duration.ofMillis(2000)
        )), any(ConnectorContext.class));
        verify(logService).recordSuccess(eq("http"), any(ConnectorContext.class), any(ConnectorRequest.class), any(ConnectorResponse.class), any(Long.class));
        verify(execution).setVariable(eq("connectorResult"), any(Map.class));
    }

    private Expression expression(String value) {
        Expression expression = mock(Expression.class);
        when(expression.getValue(any())).thenReturn(value);
        return expression;
    }
}
