package io.koravo.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

class RolePermissionFilterTest {
    private final RolePermissionFilter filter = new RolePermissionFilter();

    @AfterEach
    void tearDown() {
        UserContextHolder.clear();
    }

    @Test
    void applicantCanStartProcessButCannotReadProcessModelConsole() throws Exception {
        UserContextHolder.setUser("starter", UserContextHolder.ROLE_APPLICANT);

        assertThat(allows("POST", "/api/v1/process-instances/start")).isTrue();
        assertThat(allows("GET", "/api/v1/forms/snapshots")).isTrue();
        assertThat(allows("GET", "/api/v1/process-models")).isFalse();
    }

    @Test
    void approvalRolesCanHandleTasksButCannotOpenOpsConsole() throws Exception {
        UserContextHolder.setUser("manager", UserContextHolder.ROLE_MANAGER);

        assertThat(allows("POST", "/api/v1/tasks/task-1/complete")).isTrue();
        assertThat(allows("GET", "/api/v1/process-instances/pi-1/trace")).isTrue();
        assertThat(allows("GET", "/api/v1/ops/process-instances")).isFalse();
    }

    @Test
    void adminCanUseConfigurationAndAuditEndpoints() throws Exception {
        UserContextHolder.setUser("admin", UserContextHolder.ROLE_ADMIN);

        assertThat(allows("POST", "/api/v1/process-models")).isTrue();
        assertThat(allows("POST", "/api/v1/process-instances/start")).isFalse();
        assertThat(allows("GET", "/api/v1/tasks/my")).isFalse();
        assertThat(allows("GET", "/api/v1/audit-logs")).isFalse();
        assertThat(allows("GET", "/api/v1/connector-execution-logs")).isFalse();
    }

    @Test
    void operatorCanUseOpsAndAuditButCannotChangeWorkflowConfiguration() throws Exception {
        UserContextHolder.setUser("operator", UserContextHolder.ROLE_OPERATOR);

        assertThat(allows("GET", "/api/v1/system/health")).isTrue();
        assertThat(allows("GET", "/api/v1/audit-logs")).isTrue();
        assertThat(allows("GET", "/api/v1/connector-execution-logs")).isTrue();
        assertThat(allows("GET", "/api/v1/tasks/my")).isFalse();
        assertThat(allows("POST", "/api/v1/process-models")).isFalse();
    }

    @Test
    void anonymousRequestsAreDeniedByRoleMatrix() throws Exception {
        assertThat(allows("GET", "/api/v1/health")).isFalse();
    }

    @Test
    void unknownAuthenticatedEndpointIsDeniedByDefault() throws Exception {
        UserContextHolder.setUser("starter", UserContextHolder.ROLE_APPLICANT);

        assertThat(allows("POST", "/api/v1/internal/debug")).isFalse();
    }

    private boolean allows(String method, String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);

        filter.doFilter(request, response, (servletRequest, servletResponse) -> called.set(true));

        return called.get() && response.getStatus() < 400;
    }
}
