package io.koravo.api.organization;

import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class OrganizationDirectoryService {
    public List<OrganizationMemberResponse> members() {
        String tenantId = TenantContextHolder.getTenantId();
        return List.of(
                member("admin", tenantId, "流程平台负责人", "流程平台组", UserContextHolder.ROLE_ADMIN),
                member("applicant", tenantId, "业务申请专员", "业务一部", UserContextHolder.ROLE_APPLICANT),
                member("manager", tenantId, "业务审批主管", "业务一部", UserContextHolder.ROLE_MANAGER),
                member("finance", tenantId, "财务复核专员", "财务部门", UserContextHolder.ROLE_FINANCE)
        );
    }

    private OrganizationMemberResponse member(
            String userId,
            String tenantId,
            String name,
            String department,
            String role
    ) {
        return new OrganizationMemberResponse(
                userId,
                tenantId,
                userId,
                name,
                department,
                role,
                "ACTIVE"
        );
    }
}
