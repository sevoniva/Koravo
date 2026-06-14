package io.koravo.security;

import java.util.Optional;

public interface PlatformIdentityVerifier {
    Optional<VerifiedPlatformIdentity> verify(PlatformIdentityRequest request);

    default Optional<VerifiedPlatformIdentity> verifyToken(String token) {
        return Optional.empty();
    }

    static PlatformIdentityVerifier allowAll() {
        return request -> Optional.of(new VerifiedPlatformIdentity(
                request.tenantId(),
                request.userId(),
                request.requestedRole()
        ));
    }
}
