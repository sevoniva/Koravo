package io.koravo.api.workflow;

import io.koravo.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "流程启用", description = "初始化和检查 Koravo 基础流程配置")
@RestController
public class WorkflowEnablementController {
    private final WorkflowEnablementService workflowEnablementService;

    public WorkflowEnablementController(WorkflowEnablementService workflowEnablementService) {
        this.workflowEnablementService = workflowEnablementService;
    }

    @Operation(summary = "初始化流程配置", description = "幂等创建并部署请假审批流程、请假申请表和表单绑定。")
    @PostMapping("/api/v1/workflow-enablement/init")
    public ApiResponse<WorkflowEnablementInitResponse> init() {
        return ApiResponse.success(workflowEnablementService.init());
    }

    @Operation(summary = "查询流程配置状态", description = "返回请假审批流程、表单和绑定是否已就绪。")
    @GetMapping("/api/v1/workflow-enablement/status")
    public ApiResponse<WorkflowEnablementStatusResponse> status() {
        return ApiResponse.success(workflowEnablementService.status());
    }
}
