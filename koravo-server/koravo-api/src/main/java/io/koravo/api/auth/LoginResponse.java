package io.koravo.api.auth;

import java.time.Instant;

public record LoginResponse(
        String token,
        String tenantId,
        String userId,
        String name,
        String department,
        String role,
        Instant expiresAt
) {
}
