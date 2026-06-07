package io.koravo.api.system;

import java.time.Instant;
import java.util.List;

public record SystemHealthResponse(
        String status,
        String version,
        Instant time,
        String tenantId,
        String userId,
        List<SystemHealthItem> dependencies,
        DemoModeInfo demoMode,
        UrlPolicyInfo urlPolicy
) {
    public record SystemHealthItem(
            String key,
            String name,
            String status,
            String message
    ) {
    }

    public record DemoModeInfo(
            boolean enabled,
            String message
    ) {
    }

    public record UrlPolicyInfo(
            boolean localhostAllowed,
            boolean privateNetworkAllowed,
            boolean publicHttpsRequired,
            String message
    ) {
    }
}
