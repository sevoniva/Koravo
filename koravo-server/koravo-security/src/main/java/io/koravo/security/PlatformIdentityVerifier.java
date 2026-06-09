package io.koravo.security;

import java.util.Optional;

public interface PlatformIdentityVerifier {
    Optional<VerifiedPlatformIdentity> verify(PlatformIdentityRequest request);

    static PlatformIdentityVerifier allowAll() {
        return request -> Optional.of(new VerifiedPlatformIdentity(
                request.userId(),
                request.requestedRole()
        ));
    }
}
