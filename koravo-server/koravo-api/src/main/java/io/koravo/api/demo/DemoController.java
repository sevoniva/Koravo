package io.koravo.api.demo;

import io.koravo.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "演示数据", description = "初始化和检查 Koravo 控制台演示数据")
@RestController
public class DemoController {
    private final DemoService demoService;

    public DemoController(DemoService demoService) {
        this.demoService = demoService;
    }

    @Operation(summary = "初始化演示数据", description = "幂等创建并部署请假审批流程、请假申请表和表单绑定。")
    @PostMapping("/api/v1/demo/init")
    public ApiResponse<DemoInitResponse> init() {
        return ApiResponse.success(demoService.init());
    }

    @Operation(summary = "查询演示数据状态", description = "返回请假审批流程、表单和绑定是否已就绪。")
    @GetMapping("/api/v1/demo/status")
    public ApiResponse<DemoStatusResponse> status() {
        return ApiResponse.success(demoService.status());
    }
}
