package io.koravo.security;

public record VerifiedPlatformIdentity(
        String tenantId,
        String userId,
        String role
) {
}
