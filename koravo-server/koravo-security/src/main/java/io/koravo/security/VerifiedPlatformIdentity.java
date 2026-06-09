package io.koravo.security;

public record VerifiedPlatformIdentity(
        String userId,
        String role
) {
}
