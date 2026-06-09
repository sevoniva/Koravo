package io.koravo.api.workflow;

import io.koravo.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "流程配置检查", description = "检查并补齐 Koravo 基础流程配置")
@RestController
public class WorkflowEnablementController {
    private final WorkflowEnablementService workflowEnablementService;

    public WorkflowEnablementController(WorkflowEnablementService workflowEnablementService) {
        this.workflowEnablementService = workflowEnablementService;
    }

    @Operation(summary = "补齐基础流程配置", description = "幂等创建并部署协同审批流程、业务申请表和任务表单绑定。")
    @PostMapping("/api/v1/workflow-enablement/init")
    public ApiResponse<WorkflowEnablementInitResponse> init() {
        return ApiResponse.success(workflowEnablementService.init());
    }

    @Operation(summary = "查询流程配置状态", description = "返回协同审批流程、表单和绑定是否已就绪。")
    @GetMapping("/api/v1/workflow-enablement/status")
    public ApiResponse<WorkflowEnablementStatusResponse> status() {
        return ApiResponse.success(workflowEnablementService.status());
    }

    @Operation(summary = "查询可发起流程", description = "返回已发布、已绑定启动表单、可由当前用户发起的流程。")
    @GetMapping("/api/v1/workflow-enablement/startable-processes")
    public ApiResponse<List<StartableWorkflowResponse>> startableProcesses() {
        return ApiResponse.success(workflowEnablementService.startableProcesses());
    }
}
