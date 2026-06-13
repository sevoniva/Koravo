package io.koravo.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RolePermissionMatrixTest {
    @Test
    void capabilitiesMatchEndpointBoundaries() {
        var applicant = RolePermissionMatrix.capabilitiesForRole(UserContextHolder.ROLE_APPLICANT);
        var admin = RolePermissionMatrix.capabilitiesForRole(UserContextHolder.ROLE_ADMIN);
        var operator = RolePermissionMatrix.capabilitiesForRole(UserContextHolder.ROLE_OPERATOR);

        assertThat(applicant)
                .containsEntry("canStartProcess", true)
                .containsEntry("canConfigureWorkflow", false)
                .containsEntry("canOperateSystem", false);
        assertThat(admin)
                .containsEntry("canConfigureWorkflow", true)
                .containsEntry("canStartProcess", false)
                .containsEntry("canOperateSystem", false);
        assertThat(operator)
                .containsEntry("canViewDashboard", true)
                .containsEntry("canOperateSystem", true)
                .containsEntry("canConfigureWorkflow", false);
    }

    @Test
    void endpointAccessUsesTheSameRoleMatrix() {
        assertThat(RolePermissionMatrix.isAllowed(
                "POST",
                "/api/v1/process-instances/start",
                "applicant",
                UserContextHolder.ROLE_APPLICANT
        )).isTrue();
        assertThat(RolePermissionMatrix.isAllowed(
                "POST",
                "/api/v1/process-instances/start",
                "admin",
                UserContextHolder.ROLE_ADMIN
        )).isFalse();
        assertThat(RolePermissionMatrix.isAllowed(
                "GET",
                "/api/v1/audit-logs",
                "operator",
                UserContextHolder.ROLE_OPERATOR
        )).isTrue();
    }
}
