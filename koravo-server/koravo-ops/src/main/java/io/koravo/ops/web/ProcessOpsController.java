package io.koravo.ops.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.api.PageResult;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.InstanceQueryCommand;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.ProcessTraceDTO;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProcessOpsController {
    private final ProcessFacade processFacade;

    public ProcessOpsController(ProcessFacade processFacade) {
        this.processFacade = processFacade;
    }

    @GetMapping("/api/v1/ops/process-instances")
    public ApiResponse<PageResult<ProcessInstanceDetailDTO>> listInstances(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.success(processFacade.listInstances(
                new InstanceQueryCommand(TenantContextHolder.getTenantId(), page, pageSize)
        ));
    }

    @GetMapping("/api/v1/ops/process-instances/{instanceId}")
    public ApiResponse<ProcessInstanceDetailDTO> getInstance(@PathVariable String instanceId) {
        return ApiResponse.success(processFacade.getInstance(TenantContextHolder.getTenantId(), instanceId));
    }

    @GetMapping("/api/v1/ops/process-instances/{instanceId}/trace")
    public ApiResponse<ProcessTraceDTO> getInstanceTrace(@PathVariable String instanceId) {
        return ApiResponse.success(processFacade.getInstanceTrace(TenantContextHolder.getTenantId(), instanceId));
    }

    @PostMapping("/api/v1/ops/process-instances/{instanceId}/terminate")
    public ApiResponse<Void> terminateInstance(
            @PathVariable String instanceId,
            @RequestBody(required = false) ProcessInstanceActionRequest request
    ) {
        processFacade.terminateProcessInstance(
                TenantContextHolder.getTenantId(),
                instanceId,
                request == null ? null : request.reason()
        );
        return ApiResponse.success(null);
    }

    @PostMapping("/api/v1/ops/process-instances/{instanceId}/suspend")
    public ApiResponse<Void> suspendInstance(@PathVariable String instanceId) {
        processFacade.suspendProcessInstance(TenantContextHolder.getTenantId(), instanceId);
        return ApiResponse.success(null);
    }

    @PostMapping("/api/v1/ops/process-instances/{instanceId}/activate")
    public ApiResponse<Void> activateInstance(@PathVariable String instanceId) {
        processFacade.activateProcessInstance(TenantContextHolder.getTenantId(), instanceId);
        return ApiResponse.success(null);
    }

    public record ProcessInstanceActionRequest(String reason) {
    }
}
