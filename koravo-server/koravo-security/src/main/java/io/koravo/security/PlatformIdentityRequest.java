package io.koravo.security;

public record PlatformIdentityRequest(
        String tenantId,
        String userId,
        String requestedRole
) {
}
