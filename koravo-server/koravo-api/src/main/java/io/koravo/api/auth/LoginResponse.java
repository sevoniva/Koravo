package io.koravo.api.auth;

import java.time.Instant;
import java.util.Map;

public record LoginResponse(
        String token,
        String tenantId,
        String userId,
        String name,
        String department,
        String role,
        Instant expiresAt,
        Map<String, Boolean> permissions
) {
}
