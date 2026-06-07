package io.koravo.api.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.web.RequestContextHolder;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.StartProcessCommand;
import io.koravo.engine.dto.ProcessInstanceDTO;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class ProcessInstanceController {
    private final ProcessFacade processFacade;
    private final AuditLogService auditLogService;

    public ProcessInstanceController(ProcessFacade processFacade, AuditLogService auditLogService) {
        this.processFacade = processFacade;
        this.auditLogService = auditLogService;
    }

    @PostMapping("/api/v1/process-instances/start")
    public ApiResponse<ProcessInstanceDTO> start(@Valid @RequestBody StartProcessRequest request) {
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
        return ApiResponse.success(instance);
    }

    @GetMapping("/api/v1/process-instances/{instanceId}")
    public ApiResponse<ProcessInstanceDetailDTO> get(@PathVariable String instanceId) {
        return ApiResponse.success(processFacade.getInstance(TenantContextHolder.getTenantId(), instanceId));
    }
}
