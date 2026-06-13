package io.koravo.api.organization;

import io.koravo.common.exception.BusinessException;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrganizationDirectoryServiceTest {
    private final OrganizationMemberRepository repository = mock(OrganizationMemberRepository.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final OrganizationDirectoryService service = new OrganizationDirectoryService(
            repository,
            new BCryptPasswordEncoder(),
            auditLogService,
            "Koravo@2026"
    );

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
                .thenReturn(List.of(member("manager", "tenant-a", "审批主管", "审批中心", UserContextHolder.ROLE_MANAGER)));

        var members = service.members();

        assertThat(members).hasSize(1);
        assertThat(members).extracting(OrganizationMemberResponse::tenantId)
                .containsOnly("tenant-a");
        assertThat(members).anySatisfy(member -> {
            assertThat(member.userId()).isEqualTo("manager");
            assertThat(member.name()).isEqualTo("审批主管");
            assertThat(member.department()).isEqualTo("审批中心");
            assertThat(member.role()).isEqualTo(UserContextHolder.ROLE_MANAGER);
            assertThat(member.status()).isEqualTo("ACTIVE");
            assertThat(member.passwordConfigured()).isTrue();
        });
        verify(repository, times(2)).findByTenantIdAndDeletedFalseOrderByDepartmentAscNameAsc("tenant-a");
    }

    @Test
    void createRejectsWeakInitialPassword() {
        TenantContextHolder.setTenantId("tenant-a");
        UserContextHolder.setUserId("admin");

        assertThatThrownBy(() -> service.create(new OrganizationMemberUpsertRequest(
                "reviewer",
                "审批专员",
                "审批中心",
                UserContextHolder.ROLE_MANAGER,
                "ACTIVE",
                "1234567"
        )))
                .isInstanceOf(BusinessException.class)
                .hasMessage("密码至少 8 位，且包含字母和数字");
        verify(repository, never()).save(any(KoOrganizationMember.class));
    }

    @Test
    void resetPasswordRejectsWeakPassword() {
        TenantContextHolder.setTenantId("tenant-a");
        UserContextHolder.setUserId("admin");
        KoOrganizationMember existing = member(
                "manager",
                "tenant-a",
                "审批主管",
                "审批中心",
                UserContextHolder.ROLE_MANAGER
        );
        when(repository.findById(existing.getId())).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.resetPassword(existing.getId(), "password"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("密码至少 8 位，且包含字母和数字");
        verify(repository, never()).save(any(KoOrganizationMember.class));
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
            return saved.size() == 5
                    && saved.stream().allMatch(member -> "tenant-b".equals(member.getTenantId()))
                    && saved.stream().anyMatch(member -> UserContextHolder.ROLE_MANAGER.equals(member.getRole()))
                    && saved.stream().anyMatch(member -> UserContextHolder.ROLE_OPERATOR.equals(member.getRole()));
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
        member.setPasswordHash("{noop}test");
        return member;
    }
}
