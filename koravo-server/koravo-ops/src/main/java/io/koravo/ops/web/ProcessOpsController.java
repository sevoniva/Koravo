package io.koravo.ops.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.api.PageResult;
import io.koravo.engine.dto.OpsJobDTO;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.ProcessTraceDTO;
import io.koravo.ops.dto.OpsCapabilityResponse;
import io.koravo.ops.service.ProcessOpsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class ProcessOpsController {
    private final ProcessOpsService processOpsService;

    public ProcessOpsController(ProcessOpsService processOpsService) {
        this.processOpsService = processOpsService;
    }

    @GetMapping("/api/v1/ops/process-instances")
    public ApiResponse<PageResult<ProcessInstanceDetailDTO>> listInstances(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status
    ) {
        return ApiResponse.success(processOpsService.listInstances(page, pageSize, keyword, status));
    }

    @GetMapping("/api/v1/ops/capabilities")
    public ApiResponse<List<OpsCapabilityResponse>> capabilities() {
        return ApiResponse.success(processOpsService.capabilities());
    }

    @GetMapping("/api/v1/ops/process-instances/{instanceId}")
    public ApiResponse<ProcessInstanceDetailDTO> getInstance(@PathVariable String instanceId) {
        return ApiResponse.success(processOpsService.getInstance(instanceId));
    }

    @GetMapping("/api/v1/ops/process-instances/{instanceId}/trace")
    public ApiResponse<ProcessTraceDTO> getInstanceTrace(@PathVariable String instanceId) {
        return ApiResponse.success(processOpsService.getInstanceTrace(instanceId));
    }

    @GetMapping("/api/v1/ops/failed-jobs")
    public ApiResponse<PageResult<OpsJobDTO>> listFailedJobs(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.success(processOpsService.listFailedJobs(page, pageSize));
    }

    @GetMapping("/api/v1/ops/failed-jobs/{jobId}")
    public ApiResponse<OpsJobDTO> getFailedJob(@PathVariable String jobId) {
        return ApiResponse.success(processOpsService.getFailedJob(jobId));
    }

    @PostMapping("/api/v1/ops/failed-jobs/{jobId}/retry")
    public ApiResponse<Void> retryFailedJob(
            @PathVariable String jobId,
            @RequestBody(required = false) JobActionRequest request
    ) {
        processOpsService.retryFailedJob(jobId, request == null ? 3 : request.safeRetries());
        return ApiResponse.success(null);
    }

    @PostMapping("/api/v1/ops/failed-jobs/{jobId}/delete")
    public ApiResponse<Void> deleteFailedJob(@PathVariable String jobId) {
        processOpsService.deleteFailedJob(jobId);
        return ApiResponse.success(null);
    }

    @GetMapping("/api/v1/ops/dead-letter-jobs")
    public ApiResponse<PageResult<OpsJobDTO>> listDeadLetterJobs(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.success(processOpsService.listDeadLetterJobs(page, pageSize));
    }

    @GetMapping("/api/v1/ops/dead-letter-jobs/{jobId}")
    public ApiResponse<OpsJobDTO> getDeadLetterJob(@PathVariable String jobId) {
        return ApiResponse.success(processOpsService.getDeadLetterJob(jobId));
    }

    @PostMapping("/api/v1/ops/dead-letter-jobs/{jobId}/retry")
    public ApiResponse<Void> retryDeadLetterJob(
            @PathVariable String jobId,
            @RequestBody(required = false) JobActionRequest request
    ) {
        processOpsService.retryDeadLetterJob(jobId, request == null ? 3 : request.safeRetries());
        return ApiResponse.success(null);
    }

    @PostMapping("/api/v1/ops/dead-letter-jobs/{jobId}/delete")
    public ApiResponse<Void> deleteDeadLetterJob(@PathVariable String jobId) {
        processOpsService.deleteDeadLetterJob(jobId);
        return ApiResponse.success(null);
    }

    @PostMapping("/api/v1/ops/process-instances/{instanceId}/terminate")
    public ApiResponse<Void> terminateInstance(
            @PathVariable String instanceId,
            @RequestBody(required = false) ProcessInstanceActionRequest request
    ) {
        processOpsService.terminateInstance(instanceId, request == null ? null : request.reason());
        return ApiResponse.success(null);
    }

    @PostMapping("/api/v1/ops/process-instances/{instanceId}/suspend")
    public ApiResponse<Void> suspendInstance(
            @PathVariable String instanceId,
            @RequestBody(required = false) ProcessInstanceActionRequest request
    ) {
        processOpsService.suspendInstance(instanceId, request == null ? null : request.reason());
        return ApiResponse.success(null);
    }

    @PostMapping("/api/v1/ops/process-instances/{instanceId}/activate")
    public ApiResponse<Void> activateInstance(
            @PathVariable String instanceId,
            @RequestBody(required = false) ProcessInstanceActionRequest request
    ) {
        processOpsService.activateInstance(instanceId, request == null ? null : request.reason());
        return ApiResponse.success(null);
    }

    public record ProcessInstanceActionRequest(String reason) {
    }

    public record JobActionRequest(Integer retries) {
        int safeRetries() {
            return retries == null || retries < 1 ? 3 : retries;
        }
    }
}
