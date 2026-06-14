package io.koravo.connector.log;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.connector.core.ConnectorContext;
import io.koravo.connector.core.ConnectorRegistry;
import io.koravo.connector.core.ConnectorRequest;
import io.koravo.connector.core.ConnectorResponse;
import io.koravo.connector.domain.KoConnectorExecutionLog;
import io.koravo.connector.repo.ConnectorExecutionLogRepository;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.Map;

@Service
public class ConnectorExecutionRetryService {
    private final ConnectorExecutionLogRepository repository;
    private final ConnectorRegistry connectorRegistry;
    private final ConnectorExecutionLogService logService;
    private final AuditLogService auditLogService;

    public ConnectorExecutionRetryService(
            ConnectorExecutionLogRepository repository,
            ConnectorRegistry connectorRegistry,
            ConnectorExecutionLogService logService,
            AuditLogService auditLogService
    ) {
        this.repository = repository;
        this.connectorRegistry = connectorRegistry;
        this.logService = logService;
        this.auditLogService = auditLogService;
    }

    public KoConnectorExecutionLog retry(String id) {
        KoConnectorExecutionLog source = repository.findByIdAndTenantId(id, TenantContextHolder.getTenantId())
                .orElseThrow(() -> new BusinessException(ErrorCode.BAD_REQUEST, "连接器日志不存在"));
        if (!"FAILED".equalsIgnoreCase(source.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "仅失败记录可重试");
        }
        if (!StringUtils.hasText(source.getConnectorType()) || !StringUtils.hasText(source.getUrl())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "重试信息不完整");
        }

        ConnectorRequest request = new ConnectorRequest(
                StringUtils.hasText(source.getMethod()) ? source.getMethod() : "GET",
                source.getUrl(),
                Map.of(),
                requestBody(source.getRequestSummary()),
                Duration.ofSeconds(5)
        );
        ConnectorContext context = new ConnectorContext(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                source.getRequestId()
        );
        long started = System.currentTimeMillis();
        try {
            ConnectorResponse response = connectorRegistry.get(source.getConnectorType()).execute(request, context);
            KoConnectorExecutionLog retryLog = logService.recordSuccess(
                    source.getConnectorType(),
                    context,
                    request,
                    response,
                    System.currentTimeMillis() - started
            );
            recordRetryAudit(source, retryLog);
            return retryLog;
        } catch (RuntimeException e) {
            KoConnectorExecutionLog retryLog = logService.recordFailure(
                    source.getConnectorType(),
                    context,
                    request,
                    e,
                    System.currentTimeMillis() - started
            );
            recordRetryAudit(source, retryLog);
            throw e;
        }
    }

    private void recordRetryAudit(KoConnectorExecutionLog source, KoConnectorExecutionLog retryLog) {
        auditLogService.record("CONNECTOR_RETRY", "CONNECTOR_EXECUTION", retryLog.getId(), Map.of(
                "sourceLogId", source.getId(),
                "retryLogId", retryLog.getId(),
                "connectorType", retryLog.getConnectorType(),
                "status", retryLog.getStatus(),
                "requestId", retryLog.getRequestId() == null ? "" : retryLog.getRequestId()
        ));
    }

    private String requestBody(String requestSummary) {
        if (!StringUtils.hasText(requestSummary)) {
            return null;
        }
        int index = requestSummary.indexOf("body=");
        if (index < 0) {
            return null;
        }
        String body = requestSummary.substring(index + "body=".length());
        return "null".equals(body) ? null : body;
    }
}
