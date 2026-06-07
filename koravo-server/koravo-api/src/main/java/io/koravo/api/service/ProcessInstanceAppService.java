package io.koravo.api.service;

import io.koravo.api.web.StartProcessRequest;
import io.koravo.api.web.ProcessInstanceDetailResponse;
import io.koravo.common.web.RequestContextHolder;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.StartProcessCommand;
import io.koravo.engine.dto.ProcessInstanceDTO;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class ProcessInstanceAppService {
    private final ProcessFacade processFacade;
    private final AuditLogService auditLogService;
    private final AuditLogQueryService auditLogQueryService;

    public ProcessInstanceAppService(ProcessFacade processFacade, AuditLogService auditLogService, AuditLogQueryService auditLogQueryService) {
        this.processFacade = processFacade;
        this.auditLogService = auditLogService;
        this.auditLogQueryService = auditLogQueryService;
    }

    public ProcessInstanceDTO start(StartProcessRequest request) {
        ProcessInstanceDTO instance = processFacade.start(new StartProcessCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                RequestContextHolder.getRequestId(),
                request.processDefinitionKey(),
                request.businessKey(),
                request.variables()
        ));
        auditLogService.record("PROCESS_INSTANCE_START", "PROCESS_INSTANCE", instance.instanceId(), Map.of(
                "processDefinitionKey", request.processDefinitionKey(),
                "processDefinitionId", instance.processDefinitionId(),
                "status", instance.status(),
                "businessKey", request.businessKey()
        ));
        return instance;
    }

    public ProcessInstanceDetailResponse get(String instanceId) {
        ProcessInstanceDetailDTO instance = processFacade.getInstance(TenantContextHolder.getTenantId(), instanceId);
        return ProcessInstanceDetailResponse.from(
                instance,
                auditLogQueryService.queryByResource("PROCESS_INSTANCE", instanceId, 20)
        );
    }
}
