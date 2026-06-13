package io.koravo.api.dashboard;

import io.koravo.connector.log.ConnectorExecutionSummaryResponse;
import io.koravo.connector.log.ConnectorExecutionLogQueryService;
import io.koravo.common.model.AssetOrigin;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.InstanceQueryCommand;
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
import java.util.List;
import java.util.Set;

@Service
public class DashboardService {
    private static final List<AssetOrigin> PRODUCTION_ASSET_ORIGINS = List.of(
            AssetOrigin.SYSTEM_TEMPLATE,
            AssetOrigin.USER_FLOW
    );
    private static final Set<String> RETIRED_PROCESS_KEYS = Set.of(
            "multiAcceptance",
            "purchaseApproval",
            "leaveApproval",
            "httpConnectorDemo",
            "designerDeployCheck"
    );

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
        long runningInstances = processFacade.listInstances(new InstanceQueryCommand(tenantId, 1, 1, null, "RUNNING", RETIRED_PROCESS_KEYS)).total();
        return new DashboardSummaryResponse(
                tenantId,
                userId,
                "UP",
                version,
                Instant.now(),
                processModelRepository.countByTenantIdAndAssetOriginInAndDeletedFalse(tenantId, PRODUCTION_ASSET_ORIGINS),
                processModelRepository.countByTenantIdAndStatusAndAssetOriginInAndDeletedFalse(tenantId, ProcessModelStatus.DEPLOYED, PRODUCTION_ASSET_ORIGINS),
                runningInstances,
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
