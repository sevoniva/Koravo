package io.koravo.ops.service;

import io.koravo.common.api.PageResult;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.InstanceQueryCommand;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.ProcessTraceDTO;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.ops.dto.OpsCapabilityResponse;
import io.koravo.ops.dto.OpsSummaryResponse;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ProcessOpsService {
    private final ProcessFacade processFacade;
    private final AuditLogService auditLogService;

    public ProcessOpsService(ProcessFacade processFacade, AuditLogService auditLogService) {
        this.processFacade = processFacade;
        this.auditLogService = auditLogService;
    }

    public PageResult<ProcessInstanceDetailDTO> listInstances(int page, int pageSize) {
        return processFacade.listInstances(new InstanceQueryCommand(TenantContextHolder.getTenantId(), page, pageSize));
    }

    public ProcessInstanceDetailDTO getInstance(String instanceId) {
        return processFacade.getInstance(TenantContextHolder.getTenantId(), instanceId);
    }

    public ProcessTraceDTO getInstanceTrace(String instanceId) {
        return processFacade.getInstanceTrace(TenantContextHolder.getTenantId(), instanceId);
    }

    public OpsSummaryResponse summary(long connectorFailureCount) {
        String tenantId = TenantContextHolder.getTenantId();
        long failedJobs = processFacade.countFailedJobs(tenantId);
        long deadLetterJobs = processFacade.countDeadLetterJobs(tenantId);
        return new OpsSummaryResponse(
                processFacade.countRunningInstances(tenantId),
                failedJobs,
                deadLetterJobs,
                connectorFailureCount,
                List.of(
                        new OpsSummaryResponse.OpsSummaryItem(
                                "failed-jobs",
                                "失败任务",
                                failedJobs > 0 ? "WARN" : "OK",
                                failedJobs,
                                failedJobs > 0 ? "存在执行异常任务" : "暂无失败任务"
                        ),
                        new OpsSummaryResponse.OpsSummaryItem(
                                "dead-letter-jobs",
                                "死信任务",
                                deadLetterJobs > 0 ? "WARN" : "OK",
                                deadLetterJobs,
                                deadLetterJobs > 0 ? "存在死信任务" : "暂无死信任务"
                        ),
                        new OpsSummaryResponse.OpsSummaryItem(
                                "connector-failures",
                                "连接器失败",
                                connectorFailureCount > 0 ? "WARN" : "OK",
                                connectorFailureCount,
                                connectorFailureCount > 0 ? "存在连接器失败记录" : "暂无连接器失败"
                        )
                )
        );
    }

    public List<OpsCapabilityResponse> capabilities() {
        return List.of(
                new OpsCapabilityResponse(
                        "PROCESS_INSTANCE_INSPECTION",
                        "Process instance inspection",
                        "AVAILABLE",
                        "List, inspect, terminate, suspend, and activate process instances."
                ),
                new OpsCapabilityResponse(
                        "PROCESS_INSTANCE_TRACE",
                        "Process trace",
                        "AVAILABLE",
                        "Read current nodes, completed activities, variables, tasks, and BPMN XML."
                ),
                new OpsCapabilityResponse(
                        "CONNECTOR_EXECUTION_LOGS",
                        "Connector execution logs",
                        "AVAILABLE",
                        "Query connector executions, summaries, and recent failures."
                ),
                new OpsCapabilityResponse(
                        "FAILED_TASK_INSPECTION",
                        "Failed task inspection",
                        "PLANNED",
                        "Boundary reserved for Flowable failed job and exception inspection."
                ),
                new OpsCapabilityResponse(
                        "DEAD_LETTER_TASKS",
                        "Dead letter tasks",
                        "PLANNED",
                        "Boundary reserved for dead letter job listing and diagnostics."
                ),
                new OpsCapabilityResponse(
                        "JOB_RETRY",
                        "Job retry",
                        "PLANNED",
                        "Boundary reserved for audited retry actions after failure analysis."
                ),
                new OpsCapabilityResponse(
                        "PROCESS_MIGRATION",
                        "Process migration",
                        "PLANNED",
                        "Boundary reserved for controlled instance migration between definitions."
                )
        );
    }

    public void terminateInstance(String instanceId, String reason) {
        processFacade.terminateProcessInstance(TenantContextHolder.getTenantId(), instanceId, reason);
        auditLogService.record("PROCESS_INSTANCE_TERMINATE", "PROCESS_INSTANCE", instanceId, Map.of(
                "reason", reason == null || reason.isBlank() ? "Terminated by ops" : reason
        ));
    }

    public void suspendInstance(String instanceId) {
        processFacade.suspendProcessInstance(TenantContextHolder.getTenantId(), instanceId);
        auditLogService.record("PROCESS_INSTANCE_SUSPEND", "PROCESS_INSTANCE", instanceId, Map.of());
    }

    public void activateInstance(String instanceId) {
        processFacade.activateProcessInstance(TenantContextHolder.getTenantId(), instanceId);
        auditLogService.record("PROCESS_INSTANCE_ACTIVATE", "PROCESS_INSTANCE", instanceId, Map.of());
    }
}
