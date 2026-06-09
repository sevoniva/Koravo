package io.koravo.api.organization;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrganizationMemberRepository extends JpaRepository<KoOrganizationMember, String> {
    List<KoOrganizationMember> findByTenantIdAndDeletedFalseOrderByDepartmentAscNameAsc(String tenantId);

    long countByTenantIdAndDeletedFalse(String tenantId);
}
