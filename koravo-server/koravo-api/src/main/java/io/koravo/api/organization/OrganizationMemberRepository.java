package io.koravo.api.organization;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrganizationMemberRepository extends JpaRepository<KoOrganizationMember, String> {
    List<KoOrganizationMember> findByTenantIdAndDeletedFalseOrderByDepartmentAscNameAsc(String tenantId);

    long countByTenantIdAndDeletedFalse(String tenantId);

    Optional<KoOrganizationMember> findByTenantIdAndUserIdAndDeletedFalse(String tenantId, String userId);

    Optional<KoOrganizationMember> findFirstByTenantIdAndRoleAndStatusAndDeletedFalseOrderByNameAsc(
            String tenantId,
            String role,
            String status
    );
}
