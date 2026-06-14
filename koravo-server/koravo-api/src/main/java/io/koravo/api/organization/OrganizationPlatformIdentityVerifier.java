package io.koravo.api.organization;

import io.koravo.api.auth.AuthTokenHasher;
import io.koravo.api.auth.LoginSessionRepository;
import io.koravo.security.PlatformIdentityRequest;
import io.koravo.security.PlatformIdentityVerifier;
import io.koravo.security.VerifiedPlatformIdentity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

@Component
public class OrganizationPlatformIdentityVerifier implements PlatformIdentityVerifier {
    private static final String ACTIVE = "ACTIVE";

    private final OrganizationMemberRepository organizationMemberRepository;
    private final LoginSessionRepository loginSessionRepository;

    public OrganizationPlatformIdentityVerifier(
            OrganizationMemberRepository organizationMemberRepository,
            LoginSessionRepository loginSessionRepository
    ) {
        this.organizationMemberRepository = organizationMemberRepository;
        this.loginSessionRepository = loginSessionRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<VerifiedPlatformIdentity> verify(PlatformIdentityRequest request) {
        if (request.userId() == null || request.userId().isBlank()) {
            return Optional.empty();
        }
        return organizationMemberRepository
                .findByTenantIdAndUserIdAndDeletedFalse(request.tenantId(), request.userId())
                .filter(member -> ACTIVE.equals(member.getStatus()))
                .map(member -> new VerifiedPlatformIdentity(member.getTenantId(), member.getUserId(), member.getRole()));
    }

    @Override
    @Transactional
    public Optional<VerifiedPlatformIdentity> verifyToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        return loginSessionRepository
                .findByTokenHashAndDeletedFalse(AuthTokenHasher.hash(token))
                .filter(session -> session.getRevokedAt() == null)
                .filter(session -> session.getExpiresAt().isAfter(now))
                .flatMap(session -> organizationMemberRepository
                        .findByTenantIdAndUserIdAndDeletedFalse(session.getTenantId(), session.getUserId())
                        .filter(member -> ACTIVE.equals(member.getStatus()))
                        .map(member -> {
                            session.setLastSeenAt(now);
                            loginSessionRepository.save(session);
                            return new VerifiedPlatformIdentity(
                                    member.getTenantId(),
                                    member.getUserId(),
                                    member.getRole()
                            );
                        }));
    }
}
