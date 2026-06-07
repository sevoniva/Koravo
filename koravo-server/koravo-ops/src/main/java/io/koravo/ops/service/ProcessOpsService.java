package io.koravo.ops.service;

import io.koravo.common.api.PageResult;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.InstanceQueryCommand;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.ProcessTraceDTO;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;

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
