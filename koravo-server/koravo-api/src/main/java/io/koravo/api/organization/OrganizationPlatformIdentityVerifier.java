package io.koravo.api.organization;

import io.koravo.security.PlatformIdentityRequest;
import io.koravo.security.PlatformIdentityVerifier;
import io.koravo.security.VerifiedPlatformIdentity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Component
public class OrganizationPlatformIdentityVerifier implements PlatformIdentityVerifier {
    private static final String ACTIVE = "ACTIVE";

    private final OrganizationMemberRepository organizationMemberRepository;

    public OrganizationPlatformIdentityVerifier(OrganizationMemberRepository organizationMemberRepository) {
        this.organizationMemberRepository = organizationMemberRepository;
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
                .map(member -> new VerifiedPlatformIdentity(member.getUserId(), member.getRole()));
    }
}
