package io.koravo.connector.flowable;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.connector.core.ConnectorContext;
import io.koravo.connector.core.ConnectorRegistry;
import io.koravo.connector.core.ConnectorRequest;
import io.koravo.connector.core.ConnectorResponse;
import io.koravo.connector.log.ConnectorExecutionLogService;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Component
public class KoravoConnectorDelegate implements JavaDelegate {
    private static final TypeReference<Map<String, String>> STRING_MAP_TYPE = new TypeReference<>() {
    };

    private final ConnectorRegistry connectorRegistry;
    private final ObjectMapper objectMapper;
    private final ConnectorExecutionLogService logService;

    private Expression connectorType;
    private Expression url;
    private Expression method;
    private Expression headers;
    private Expression body;
    private Expression outputVariable;
    private Expression timeoutMillis;

    public KoravoConnectorDelegate(
            ConnectorRegistry connectorRegistry,
            ObjectMapper objectMapper,
            ConnectorExecutionLogService logService
    ) {
        this.connectorRegistry = connectorRegistry;
        this.objectMapper = objectMapper;
        this.logService = logService;
    }

    @Override
    public void execute(DelegateExecution execution) {
        String type = value(connectorType, execution, "http");
        ConnectorRequest request = new ConnectorRequest(
                value(method, execution, "GET"),
                required(value(url, execution, null), "Connector URL is required"),
                parseHeaders(value(headers, execution, null)),
                value(body, execution, null),
                Duration.ofMillis(parseTimeoutMillis(value(timeoutMillis, execution, null)))
        );
        ConnectorContext context = context(execution);
        long started = System.currentTimeMillis();
        try {
            ConnectorResponse response = connectorRegistry.get(type).execute(request, context);
            logService.recordSuccess(type, context, request, response, System.currentTimeMillis() - started);
            String outputName = value(outputVariable, execution, "connectorResult");
            execution.setVariable(outputName, Map.of(
                    "statusCode", response.statusCode(),
                    "headers", response.headers() == null ? Map.<String, List<String>>of() : response.headers(),
                    "body", response.body() == null ? "" : response.body()
            ));
        } catch (RuntimeException e) {
            logService.recordFailure(type, context, request, e, System.currentTimeMillis() - started);
            throw e;
        }
    }

    public void setConnectorType(Expression connectorType) {
        this.connectorType = connectorType;
    }

    public void setUrl(Expression url) {
        this.url = url;
    }

    public void setMethod(Expression method) {
        this.method = method;
    }

    public void setHeaders(Expression headers) {
        this.headers = headers;
    }

    public void setBody(Expression body) {
        this.body = body;
    }

    public void setOutputVariable(Expression outputVariable) {
        this.outputVariable = outputVariable;
    }

    public void setTimeoutMillis(Expression timeoutMillis) {
        this.timeoutMillis = timeoutMillis;
    }

    private ConnectorContext context(DelegateExecution execution) {
        return new ConnectorContext(
                execution.getTenantId(),
                stringVariable(execution, "startUserId", "system"),
                stringVariable(execution, "requestId", null)
        );
    }

    private Map<String, String> parseHeaders(String headersJson) {
        if (!StringUtils.hasText(headersJson)) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(headersJson, STRING_MAP_TYPE);
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Connector headers must be a JSON object");
        }
    }

    private long parseTimeoutMillis(String raw) {
        if (!StringUtils.hasText(raw)) {
            return 5000;
        }
        try {
            return Math.max(1, Long.parseLong(raw));
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Connector timeoutMillis must be a number");
        }
    }

    private String value(Expression expression, DelegateExecution execution, String fallback) {
        if (expression == null) {
            return fallback;
        }
        Object raw = expression.getValue(execution);
        return raw == null ? fallback : String.valueOf(raw);
    }

    private String stringVariable(DelegateExecution execution, String name, String fallback) {
        Object raw = execution.getVariable(name);
        return raw == null ? fallback : String.valueOf(raw);
    }

    private String required(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, message);
        }
        return value;
    }
}
