package io.koravo.api.organization;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrganizationMemberRepository extends JpaRepository<KoOrganizationMember, String> {
    List<KoOrganizationMember> findByTenantIdAndDeletedFalseOrderByDepartmentAscNameAsc(String tenantId);

    long countByTenantIdAndDeletedFalse(String tenantId);

    long countByTenantIdAndRoleAndStatusAndDeletedFalse(String tenantId, String role, String status);

    boolean existsByTenantIdAndUserIdAndDeletedFalse(String tenantId, String userId);

    Optional<KoOrganizationMember> findByTenantIdAndUserIdAndDeletedFalse(String tenantId, String userId);

    List<KoOrganizationMember> findByTenantIdAndUserIdInAndStatusAndDeletedFalse(
            String tenantId,
            List<String> userIds,
            String status
    );

    Optional<KoOrganizationMember> findFirstByTenantIdAndRoleAndStatusAndDeletedFalseOrderByNameAsc(
            String tenantId,
            String role,
            String status
    );
}
