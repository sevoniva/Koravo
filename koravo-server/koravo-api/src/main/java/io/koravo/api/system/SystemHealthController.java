package io.koravo.api.system;

import io.koravo.common.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SystemHealthController {
    private final SystemHealthService systemHealthService;

    public SystemHealthController(SystemHealthService systemHealthService) {
        this.systemHealthService = systemHealthService;
    }

    @GetMapping("/api/v1/system/health")
    public ApiResponse<SystemHealthResponse> health() {
        return ApiResponse.success(systemHealthService.health());
    }
}
