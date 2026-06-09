package io.koravo.api.organization;

import io.koravo.security.PlatformIdentityRequest;
import io.koravo.security.UserContextHolder;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OrganizationPlatformIdentityVerifierTest {
    private final OrganizationMemberRepository repository = mock(OrganizationMemberRepository.class);
    private final OrganizationPlatformIdentityVerifier verifier = new OrganizationPlatformIdentityVerifier(repository);

    @Test
    void verifiesActiveMemberFromCurrentTenantDirectory() {
        KoOrganizationMember member = member("tenant-a", "manager", UserContextHolder.ROLE_MANAGER, "ACTIVE");
        when(repository.findByTenantIdAndUserIdAndDeletedFalse("tenant-a", "manager"))
                .thenReturn(Optional.of(member));

        var identity = verifier.verify(new PlatformIdentityRequest("tenant-a", "manager", "admin"));

        assertThat(identity).isPresent();
        assertThat(identity.get().userId()).isEqualTo("manager");
        assertThat(identity.get().role()).isEqualTo(UserContextHolder.ROLE_MANAGER);
    }

    @Test
    void rejectsUserMissingFromCurrentTenantDirectory() {
        when(repository.findByTenantIdAndUserIdAndDeletedFalse("tenant-a", "manager"))
                .thenReturn(Optional.empty());

        var identity = verifier.verify(new PlatformIdentityRequest("tenant-a", "manager", "manager"));

        assertThat(identity).isEmpty();
    }

    @Test
    void rejectsInactiveMember() {
        KoOrganizationMember member = member("tenant-a", "manager", UserContextHolder.ROLE_MANAGER, "DISABLED");
        when(repository.findByTenantIdAndUserIdAndDeletedFalse("tenant-a", "manager"))
                .thenReturn(Optional.of(member));

        var identity = verifier.verify(new PlatformIdentityRequest("tenant-a", "manager", "manager"));

        assertThat(identity).isEmpty();
    }

    private KoOrganizationMember member(String tenantId, String userId, String role, String status) {
        KoOrganizationMember member = new KoOrganizationMember();
        member.setId(tenantId + "-" + userId);
        member.setTenantId(tenantId);
        member.setUserId(userId);
        member.setName(userId);
        member.setDepartment("测试部门");
        member.setRole(role);
        member.setStatus(status);
        return member;
    }
}
