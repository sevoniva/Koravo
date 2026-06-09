package io.koravo.api.organization;

import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OrganizationDirectoryServiceTest {
    private final OrganizationDirectoryService service = new OrganizationDirectoryService();

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void membersComeFromTenantScopedPlatformDirectory() {
        TenantContextHolder.setTenantId("tenant-a");

        var members = service.members();

        assertThat(members).hasSize(4);
        assertThat(members).extracting(OrganizationMemberResponse::tenantId)
                .containsOnly("tenant-a");
        assertThat(members).anySatisfy(member -> {
            assertThat(member.userId()).isEqualTo("manager");
            assertThat(member.name()).isEqualTo("业务审批主管");
            assertThat(member.department()).isEqualTo("业务一部");
            assertThat(member.role()).isEqualTo(UserContextHolder.ROLE_MANAGER);
            assertThat(member.status()).isEqualTo("ACTIVE");
        });
    }
}
