package io.koravo.api.web;

import io.koravo.api.service.ProcessInstanceAppService;
import io.koravo.common.api.ApiResponse;
import io.koravo.engine.dto.ProcessInstanceDTO;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProcessInstanceController {
    private final ProcessInstanceAppService processInstanceAppService;

    public ProcessInstanceController(ProcessInstanceAppService processInstanceAppService) {
        this.processInstanceAppService = processInstanceAppService;
    }

    @PostMapping("/api/v1/process-instances/start")
    public ApiResponse<ProcessInstanceDTO> start(@Valid @RequestBody StartProcessRequest request) {
        return ApiResponse.success(processInstanceAppService.start(request));
    }

    @GetMapping("/api/v1/process-instances/{instanceId}")
    public ApiResponse<ProcessInstanceDetailDTO> get(@PathVariable String instanceId) {
        return ApiResponse.success(processInstanceAppService.get(instanceId));
    }
}
