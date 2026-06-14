package io.koravo.ops.service;

import io.koravo.common.api.PageResult;
import io.koravo.common.workflow.RuntimeVisibilityPolicy;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.InstanceQueryCommand;
import io.koravo.engine.dto.OpsJobDTO;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.ProcessTraceDTO;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.ops.dto.OpsCapabilityResponse;
import io.koravo.ops.dto.OpsSummaryResponse;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ProcessOpsService {
    private final ProcessFacade processFacade;
    private final AuditLogService auditLogService;

    public ProcessOpsService(ProcessFacade processFacade, AuditLogService auditLogService) {
        this.processFacade = processFacade;
        this.auditLogService = auditLogService;
    }

    public PageResult<ProcessInstanceDetailDTO> listInstances(int page, int pageSize, String keyword, String status) {
        return listInstances(page, pageSize, keyword, status, false);
    }

    public PageResult<ProcessInstanceDetailDTO> listInstances(int page, int pageSize, String keyword, String status, boolean includeNonProduction) {
        return processFacade.listInstances(new InstanceQueryCommand(
                TenantContextHolder.getTenantId(),
                page,
                pageSize,
                keyword,
                status,
                includeNonProduction ? Set.of() : RuntimeVisibilityPolicy.HIDDEN_PROCESS_DEFINITION_PATTERNS,
                includeNonProduction ? Set.of() : RuntimeVisibilityPolicy.HIDDEN_BUSINESS_KEY_PATTERNS
        ));
    }

    public ProcessInstanceDetailDTO getInstance(String instanceId) {
        return processFacade.getInstance(TenantContextHolder.getTenantId(), instanceId);
    }

    public ProcessTraceDTO getInstanceTrace(String instanceId) {
        return processFacade.getInstanceTrace(TenantContextHolder.getTenantId(), instanceId);
    }

    public PageResult<OpsJobDTO> listFailedJobs(int page, int pageSize) {
        return processFacade.listFailedJobs(TenantContextHolder.getTenantId(), page, pageSize);
    }

    public PageResult<OpsJobDTO> listDeadLetterJobs(int page, int pageSize) {
        return processFacade.listDeadLetterJobs(TenantContextHolder.getTenantId(), page, pageSize);
    }

    public OpsJobDTO getFailedJob(String jobId) {
        return processFacade.getFailedJob(TenantContextHolder.getTenantId(), jobId);
    }

    public OpsJobDTO getDeadLetterJob(String jobId) {
        return processFacade.getDeadLetterJob(TenantContextHolder.getTenantId(), jobId);
    }

    public OpsSummaryResponse summary(long connectorFailureCount) {
        String tenantId = TenantContextHolder.getTenantId();
        long failedJobs = processFacade.countFailedJobs(tenantId);
        long deadLetterJobs = processFacade.countDeadLetterJobs(tenantId);
        long runningInstances = processFacade.listInstances(new InstanceQueryCommand(
                tenantId,
                1,
                1,
                null,
                "RUNNING",
                RuntimeVisibilityPolicy.HIDDEN_PROCESS_DEFINITION_PATTERNS,
                RuntimeVisibilityPolicy.HIDDEN_BUSINESS_KEY_PATTERNS
        )).total();
        return new OpsSummaryResponse(
                runningInstances,
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
                        "流程实例查看",
                        "AVAILABLE",
                        "查看、终止、挂起和激活流程实例。"
                ),
                new OpsCapabilityResponse(
                        "PROCESS_INSTANCE_TRACE",
                        "流程追踪",
                        "AVAILABLE",
                        "查看当前节点、历史活动、变量、任务和流程图。"
                ),
                new OpsCapabilityResponse(
                        "CONNECTOR_EXECUTION_LOGS",
                        "连接器日志",
                        "AVAILABLE",
                        "查询连接器调用记录、摘要和近期失败。"
                ),
                new OpsCapabilityResponse(
                        "FAILED_TASK_INSPECTION",
                        "失败任务查看",
                        "AVAILABLE",
                        "查看失败任务详情和异常信息。"
                ),
                new OpsCapabilityResponse(
                        "DEAD_LETTER_TASKS",
                        "死信任务处理",
                        "AVAILABLE",
                        "查看、重试和删除死信任务。"
                ),
                new OpsCapabilityResponse(
                        "JOB_RETRY",
                        "任务重试",
                        "AVAILABLE",
                        "重试失败任务和死信任务，并写入审计日志。"
                )
        );
    }

    public void terminateInstance(String instanceId, String reason) {
        processFacade.terminateProcessInstance(TenantContextHolder.getTenantId(), instanceId, reason);
        auditLogService.record("PROCESS_INSTANCE_TERMINATE", "PROCESS_INSTANCE", instanceId, Map.of(
                "reason", reason == null || reason.isBlank() ? "Terminated by ops" : reason
        ));
    }

    public void suspendInstance(String instanceId, String reason) {
        processFacade.suspendProcessInstance(TenantContextHolder.getTenantId(), instanceId);
        auditLogService.record("PROCESS_INSTANCE_SUSPEND", "PROCESS_INSTANCE", instanceId, Map.of(
                "reason", reason == null || reason.isBlank() ? "Suspend by ops" : reason
        ));
    }

    public void activateInstance(String instanceId, String reason) {
        processFacade.activateProcessInstance(TenantContextHolder.getTenantId(), instanceId);
        auditLogService.record("PROCESS_INSTANCE_ACTIVATE", "PROCESS_INSTANCE", instanceId, Map.of(
                "reason", reason == null || reason.isBlank() ? "Activate by ops" : reason
        ));
    }

    public void retryFailedJob(String jobId, int retries) {
        OpsJobDTO job = processFacade.getFailedJob(TenantContextHolder.getTenantId(), jobId);
        int safeRetries = Math.max(retries, 1);
        processFacade.retryFailedJob(TenantContextHolder.getTenantId(), jobId, retries);
        Map<String, Object> detail = jobAuditDetail(job);
        detail.put("retries", safeRetries);
        auditLogService.record("FAILED_JOB_RETRY", "FAILED_JOB", jobId, detail);
    }

    public void retryDeadLetterJob(String jobId, int retries) {
        OpsJobDTO job = processFacade.getDeadLetterJob(TenantContextHolder.getTenantId(), jobId);
        int safeRetries = Math.max(retries, 1);
        processFacade.retryDeadLetterJob(TenantContextHolder.getTenantId(), jobId, retries);
        Map<String, Object> detail = jobAuditDetail(job);
        detail.put("retries", safeRetries);
        auditLogService.record("DEAD_LETTER_JOB_RETRY", "DEAD_LETTER_JOB", jobId, detail);
    }

    public void deleteFailedJob(String jobId) {
        OpsJobDTO job = processFacade.getFailedJob(TenantContextHolder.getTenantId(), jobId);
        processFacade.deleteFailedJob(TenantContextHolder.getTenantId(), jobId);
        auditLogService.record("FAILED_JOB_DELETE", "FAILED_JOB", jobId, jobAuditDetail(job));
    }

    public void deleteDeadLetterJob(String jobId) {
        OpsJobDTO job = processFacade.getDeadLetterJob(TenantContextHolder.getTenantId(), jobId);
        processFacade.deleteDeadLetterJob(TenantContextHolder.getTenantId(), jobId);
        auditLogService.record("DEAD_LETTER_JOB_DELETE", "DEAD_LETTER_JOB", jobId, jobAuditDetail(job));
    }

    private Map<String, Object> jobAuditDetail(OpsJobDTO job) {
        Map<String, Object> detail = new LinkedHashMap<>();
        if (job == null) {
            return detail;
        }
        putIfPresent(detail, "jobType", job.type());
        putIfPresent(detail, "processInstanceId", job.processInstanceId());
        putIfPresent(detail, "processDefinitionId", job.processDefinitionId());
        putIfPresent(detail, "executionId", job.executionId());
        putIfPresent(detail, "elementId", job.elementId());
        putIfPresent(detail, "elementName", job.elementName());
        putIfPresent(detail, "handlerType", job.handlerType());
        putIfPresent(detail, "exceptionMessage", job.exceptionMessage());
        return detail;
    }

    private void putIfPresent(Map<String, Object> detail, String key, Object value) {
        if (value == null) {
            return;
        }
        if (value instanceof String text && text.isBlank()) {
            return;
        }
        detail.put(key, value);
    }
}
