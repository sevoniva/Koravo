package io.koravo.api.dashboard;

import io.koravo.connector.log.ConnectorExecutionSummaryResponse;
import io.koravo.connector.log.ConnectorExecutionLogQueryService;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.TaskQueryCommand;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogRepository;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@Service
public class DashboardService {
    private final ProcessFacade processFacade;
    private final ProcessModelRepository processModelRepository;
    private final AuditLogQueryService auditLogQueryService;
    private final AuditLogRepository auditLogRepository;
    private final ConnectorExecutionLogQueryService connectorLogQueryService;

    @Value("${koravo.version:0.1.0-SNAPSHOT}")
    private String version = "0.1.0-SNAPSHOT";

    public DashboardService(
            ProcessFacade processFacade,
            ProcessModelRepository processModelRepository,
            AuditLogQueryService auditLogQueryService,
            AuditLogRepository auditLogRepository,
            ConnectorExecutionLogQueryService connectorLogQueryService
    ) {
        this.processFacade = processFacade;
        this.processModelRepository = processModelRepository;
        this.auditLogQueryService = auditLogQueryService;
        this.auditLogRepository = auditLogRepository;
        this.connectorLogQueryService = connectorLogQueryService;
    }

    public DashboardSummaryResponse summary() {
        String tenantId = TenantContextHolder.getTenantId();
        String userId = UserContextHolder.getUserId();
        ConnectorExecutionSummaryResponse connectorSummary = connectorLogQueryService.summary("http");
        return new DashboardSummaryResponse(
                tenantId,
                userId,
                "UP",
                version,
                Instant.now(),
                processModelRepository.countByTenantIdAndDeletedFalse(tenantId),
                processModelRepository.countByTenantIdAndStatusAndDeletedFalse(tenantId, ProcessModelStatus.DEPLOYED),
                processFacade.countRunningInstances(tenantId),
                processFacade.queryMyTasks(new TaskQueryCommand(tenantId, userId, 1, 1, null, null, null, null)).total(),
                auditLogRepository.countByTenantIdAndActionAndCreatedAtGreaterThanEqual(
                        tenantId,
                        "TASK_COMPLETE",
                        LocalDate.now(ZoneId.systemDefault()).atStartOfDay(ZoneId.systemDefault()).toInstant()
                ),
                connectorSummary.success(),
                connectorSummary.failed(),
                processFacade.countFailedJobs(tenantId),
                processFacade.countDeadLetterJobs(tenantId),
                auditLogQueryService.query(null, null, null, null, null, null, null, 1, 8).items(),
                connectorSummary
        );
    }
}
