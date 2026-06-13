package io.koravo.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.ArrayList;
import java.util.List;
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
        assertThat(allows("GET", "/api/v1/audit-logs")).isTrue();
        assertThat(allows("GET", "/api/v1/connector-execution-logs")).isTrue();
        assertThat(allows("GET", "/api/v1/ops/process-instances")).isFalse();
    }

    @Test
    void operatorCanUseOpsAndAuditButCannotChangeWorkflowConfiguration() throws Exception {
        UserContextHolder.setUser("operator", UserContextHolder.ROLE_OPERATOR);

        assertThat(allows("GET", "/api/v1/system/health")).isTrue();
        assertThat(allows("GET", "/api/v1/audit-logs")).isTrue();
        assertThat(allows("GET", "/api/v1/connector-execution-logs")).isTrue();
        assertThat(allows("GET", "/api/v1/process-instances/pi-1")).isTrue();
        assertThat(allows("GET", "/api/v1/process-instances/pi-1/trace")).isTrue();
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

    @Test
    void deniedRequestsPublishAccessDeniedAuditEvent() throws Exception {
        List<Object> events = new ArrayList<>();
        RolePermissionFilter auditFilter = new RolePermissionFilter(events::add);
        UserContextHolder.setUser("starter", UserContextHolder.ROLE_APPLICANT);

        assertThat(allows(auditFilter, "GET", "/api/v1/process-models")).isFalse();

        assertThat(events).singleElement().satisfies(event -> {
            assertThat(event).isInstanceOf(AccessDeniedAuditEvent.class);
            AccessDeniedAuditEvent auditEvent = (AccessDeniedAuditEvent) event;
            assertThat(auditEvent.method()).isEqualTo("GET");
            assertThat(auditEvent.path()).isEqualTo("/api/v1/process-models");
            assertThat(auditEvent.userId()).isEqualTo("starter");
            assertThat(auditEvent.role()).isEqualTo(UserContextHolder.ROLE_APPLICANT);
        });
    }

    private boolean allows(String method, String path) throws Exception {
        return allows(filter, method, path);
    }

    private boolean allows(RolePermissionFilter targetFilter, String method, String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.setRequestURI(path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicBoolean called = new AtomicBoolean(false);

        targetFilter.doFilter(request, response, (servletRequest, servletResponse) -> called.set(true));

        return called.get() && response.getStatus() < 400;
    }
}
