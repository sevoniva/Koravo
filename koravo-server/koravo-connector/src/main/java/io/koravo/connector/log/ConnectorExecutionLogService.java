package io.koravo.connector.log;

import io.koravo.connector.core.ConnectorContext;
import io.koravo.connector.core.ConnectorRequest;
import io.koravo.connector.core.ConnectorResponse;
import io.koravo.connector.domain.KoConnectorExecutionLog;
import io.koravo.connector.repo.ConnectorExecutionLogRepository;
import io.koravo.ops.audit.AuditLogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Map;

@Service
public class ConnectorExecutionLogService {
    private final ConnectorExecutionLogRepository repository;
    private final AuditLogService auditLogService;

    public ConnectorExecutionLogService(ConnectorExecutionLogRepository repository, AuditLogService auditLogService) {
        this.repository = repository;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public KoConnectorExecutionLog recordSuccess(
            String connectorType,
            ConnectorContext context,
            ConnectorRequest request,
            ConnectorResponse response,
            long elapsedMillis
    ) {
        KoConnectorExecutionLog log = base(connectorType, context, request, elapsedMillis);
        log.setStatus("SUCCESS");
        log.setStatusCode(response.statusCode());
        log.setResponseSummary(redact("statusCode=" + response.statusCode() + ", body=" + response.body()));
        KoConnectorExecutionLog saved = repository.save(log);
        recordAudit(saved);
        return saved;
    }

    @Transactional
    public KoConnectorExecutionLog recordFailure(
            String connectorType,
            ConnectorContext context,
            ConnectorRequest request,
            Exception error,
            long elapsedMillis
    ) {
        KoConnectorExecutionLog log = base(connectorType, context, request, elapsedMillis);
        log.setStatus("FAILED");
        log.setErrorMessage(redact(error.getMessage()));
        KoConnectorExecutionLog saved = repository.save(log);
        recordAudit(saved);
        return saved;
    }

    private void recordAudit(KoConnectorExecutionLog log) {
        auditLogService.record("CONNECTOR_EXECUTE", "CONNECTOR_EXECUTION", log.getId(), Map.of(
                "connectorType", log.getConnectorType(),
                "status", log.getStatus(),
                "statusCode", log.getStatusCode() == null ? "" : log.getStatusCode(),
                "requestId", log.getRequestId() == null ? "" : log.getRequestId(),
                "elapsedMillis", log.getElapsedMillis()
        ));
    }

    private KoConnectorExecutionLog base(
            String connectorType,
            ConnectorContext context,
            ConnectorRequest request,
            long elapsedMillis
    ) {
        KoConnectorExecutionLog log = new KoConnectorExecutionLog();
        log.setTenantId(context.tenantId());
        log.setCreatedBy(context.userId());
        log.setUpdatedBy(context.userId());
        log.setConnectorType(connectorType);
        log.setMethod(request.method());
        log.setUrl(redact(request.url()));
        log.setRequestId(context.requestId());
        log.setElapsedMillis(elapsedMillis);
        log.setRequestSummary(redact("method=" + request.method()
                + ", url=" + request.url()
                + ", headers=" + request.headers()
                + ", body=" + request.body()));
        return log;
    }

    private String redact(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        return value
                .replaceAll("(?i)(password|token|secret)(=|\\\":\\\"|:)[^\\s,}&]+", "$1$2***")
                .replaceAll("(?i)(Authorization=)[^,}]+", "$1***")
                .replaceAll("(?i)(Bearer\\s+)[^\\s,}]+", "$1***");
    }
}
