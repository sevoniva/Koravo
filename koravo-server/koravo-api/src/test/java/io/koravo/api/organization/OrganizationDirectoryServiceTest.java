package io.koravo.api.organization;

import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrganizationDirectoryServiceTest {
    private final OrganizationMemberRepository repository = mock(OrganizationMemberRepository.class);
    private final OrganizationDirectoryService service = new OrganizationDirectoryService(repository);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void membersComeFromTenantScopedPlatformDirectory() {
        TenantContextHolder.setTenantId("tenant-a");
        when(repository.countByTenantIdAndDeletedFalse("tenant-a")).thenReturn(1L);
        when(repository.findByTenantIdAndDeletedFalseOrderByDepartmentAscNameAsc("tenant-a"))
                .thenReturn(List.of(member("manager", "tenant-a", "业务审批主管", "业务一部", UserContextHolder.ROLE_MANAGER)));

        var members = service.members();

        assertThat(members).hasSize(1);
        assertThat(members).extracting(OrganizationMemberResponse::tenantId)
                .containsOnly("tenant-a");
        assertThat(members).anySatisfy(member -> {
            assertThat(member.userId()).isEqualTo("manager");
            assertThat(member.name()).isEqualTo("业务审批主管");
            assertThat(member.department()).isEqualTo("业务一部");
            assertThat(member.role()).isEqualTo(UserContextHolder.ROLE_MANAGER);
            assertThat(member.status()).isEqualTo("ACTIVE");
        });
        verify(repository).findByTenantIdAndDeletedFalseOrderByDepartmentAscNameAsc("tenant-a");
    }

    @Test
    void initializesTenantDirectoryWhenNoSyncedMembersExist() {
        TenantContextHolder.setTenantId("tenant-b");
        when(repository.countByTenantIdAndDeletedFalse("tenant-b")).thenReturn(0L);
        when(repository.findByTenantIdAndDeletedFalseOrderByDepartmentAscNameAsc("tenant-b"))
                .thenReturn(List.of(member("applicant", "tenant-b", "业务申请专员", "业务一部", UserContextHolder.ROLE_APPLICANT)));

        var members = service.members();

        assertThat(members).extracting(OrganizationMemberResponse::tenantId).containsOnly("tenant-b");
        verify(repository).saveAll(argThat(savedMembers -> {
            List<KoOrganizationMember> saved = (List<KoOrganizationMember>) savedMembers;
            return saved.size() == 4
                    && saved.stream().allMatch(member -> "tenant-b".equals(member.getTenantId()))
                    && saved.stream().anyMatch(member -> UserContextHolder.ROLE_MANAGER.equals(member.getRole()));
        }));
    }

    private KoOrganizationMember member(String userId, String tenantId, String name, String department, String role) {
        KoOrganizationMember member = new KoOrganizationMember();
        member.setId(userId + "-" + tenantId);
        member.setTenantId(tenantId);
        member.setUserId(userId);
        member.setName(name);
        member.setDepartment(department);
        member.setRole(role);
        member.setStatus("ACTIVE");
        return member;
    }
}
