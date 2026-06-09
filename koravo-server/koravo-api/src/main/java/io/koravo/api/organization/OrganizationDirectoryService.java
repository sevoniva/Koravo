package io.koravo.api.organization;

import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OrganizationDirectoryService {
    private static final String ACTIVE = "ACTIVE";

    private final OrganizationMemberRepository organizationMemberRepository;

    public OrganizationDirectoryService(OrganizationMemberRepository organizationMemberRepository) {
        this.organizationMemberRepository = organizationMemberRepository;
    }

    @Transactional
    public List<OrganizationMemberResponse> members() {
        String tenantId = TenantContextHolder.getTenantId();
        ensureTenantDirectory(tenantId);
        return organizationMemberRepository
                .findByTenantIdAndDeletedFalseOrderByDepartmentAscNameAsc(tenantId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private void ensureTenantDirectory(String tenantId) {
        if (organizationMemberRepository.countByTenantIdAndDeletedFalse(tenantId) > 0) {
            return;
        }
        organizationMemberRepository.saveAll(List.of(
                member("admin", tenantId, "流程平台负责人", "流程平台组", UserContextHolder.ROLE_ADMIN),
                member("applicant", tenantId, "业务申请专员", "业务一部", UserContextHolder.ROLE_APPLICANT),
                member("manager", tenantId, "业务审批主管", "业务一部", UserContextHolder.ROLE_MANAGER),
                member("finance", tenantId, "财务复核专员", "财务部门", UserContextHolder.ROLE_FINANCE)
        ));
    }

    private KoOrganizationMember member(String userId, String tenantId, String name, String department, String role) {
        KoOrganizationMember member = new KoOrganizationMember();
        member.setTenantId(tenantId);
        member.setCreatedBy("system");
        member.setUpdatedBy("system");
        member.setUserId(userId);
        member.setName(name);
        member.setDepartment(department);
        member.setRole(role);
        member.setStatus(ACTIVE);
        return member;
    }

    private OrganizationMemberResponse toResponse(KoOrganizationMember member) {
        return new OrganizationMemberResponse(
                member.getId(),
                member.getTenantId(),
                member.getUserId(),
                member.getName(),
                member.getDepartment(),
                member.getRole(),
                member.getStatus()
        );
    }
}
