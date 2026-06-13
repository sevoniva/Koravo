package io.koravo.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RolePermissionMatrixTest {
    @Test
    void capabilitiesMatchEndpointBoundaries() {
        var applicant = RolePermissionMatrix.capabilitiesForRole(UserContextHolder.ROLE_APPLICANT);
        var manager = RolePermissionMatrix.capabilitiesForRole(UserContextHolder.ROLE_MANAGER);
        var admin = RolePermissionMatrix.capabilitiesForRole(UserContextHolder.ROLE_ADMIN);
        var operator = RolePermissionMatrix.capabilitiesForRole(UserContextHolder.ROLE_OPERATOR);

        assertThat(applicant)
                .containsEntry("canViewProcessContext", true)
                .containsEntry("canStartProcess", true)
                .containsEntry("canHandleTask", false)
                .containsEntry("canConfigureWorkflow", false)
                .containsEntry("canViewAudit", false)
                .containsEntry("canOperateSystem", false);
        assertThat(manager)
                .containsEntry("canViewOwnWork", true)
                .containsEntry("canHandleTask", true)
                .containsEntry("canStartProcess", false)
                .containsEntry("canConfigureWorkflow", false);
        assertThat(admin)
                .containsEntry("canViewProcessContext", false)
                .containsEntry("canConfigureWorkflow", true)
                .containsEntry("canStartProcess", false)
                .containsEntry("canViewAudit", true)
                .containsEntry("canOperateSystem", false);
        assertThat(operator)
                .containsEntry("canViewDashboard", true)
                .containsEntry("canViewProcessContext", true)
                .containsEntry("canViewAudit", true)
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
                "/api/v1/tasks/my",
                "applicant",
                UserContextHolder.ROLE_APPLICANT
        )).isFalse();
        assertThat(RolePermissionMatrix.isAllowed(
                "GET",
                "/api/v1/tasks/my",
                "manager",
                UserContextHolder.ROLE_MANAGER
        )).isTrue();
        assertThat(RolePermissionMatrix.isAllowed(
                "GET",
                "/api/v1/audit-logs",
                "operator",
                UserContextHolder.ROLE_OPERATOR
        )).isTrue();
        assertThat(RolePermissionMatrix.isAllowed(
                "GET",
                "/api/v1/audit-logs",
                "admin",
                UserContextHolder.ROLE_ADMIN
        )).isTrue();
        assertThat(RolePermissionMatrix.isAllowed(
                "GET",
                "/api/v1/audit-logs",
                "applicant",
                UserContextHolder.ROLE_APPLICANT
        )).isFalse();
        assertThat(RolePermissionMatrix.isAllowed(
                "GET",
                "/api/v1/forms/snapshots",
                "operator",
                UserContextHolder.ROLE_OPERATOR
        )).isTrue();
        assertThat(RolePermissionMatrix.isAllowed(
                "GET",
                "/api/v1/process-instances/pi-1/trace",
                "operator",
                UserContextHolder.ROLE_OPERATOR
        )).isTrue();
        assertThat(RolePermissionMatrix.isAllowed(
                "GET",
                "/api/v1/process-instances/pi-1/trace",
                "admin",
                UserContextHolder.ROLE_ADMIN
        )).isFalse();
    }
}
