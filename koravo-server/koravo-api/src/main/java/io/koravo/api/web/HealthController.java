package io.koravo.api.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.security.RolePermissionMatrix;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class HealthController {
    @Value("${koravo.version:0.1.0-SNAPSHOT}")
    private String version = "0.1.0-SNAPSHOT";

    @GetMapping("/api/v1/health")
    public ApiResponse<Map<String, Object>> health() {
        return ApiResponse.success(Map.of(
                "status", "UP",
                "version", version,
                "time", Instant.now().toString(),
                "tenantId", TenantContextHolder.getTenantId(),
                "userId", UserContextHolder.getUserId(),
                "role", UserContextHolder.getRole(),
                "permissions", RolePermissionMatrix.capabilitiesForRole(UserContextHolder.getRole())
        ));
    }
}
