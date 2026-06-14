package io.koravo.security;

import org.springframework.http.HttpMethod;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class RolePermissionMatrix {
    private static final List<String> ALL_BUSINESS_ROLES = List.of(
            UserContextHolder.ROLE_ADMIN,
            UserContextHolder.ROLE_APPLICANT,
            UserContextHolder.ROLE_MANAGER,
            UserContextHolder.ROLE_FINANCE,
            UserContextHolder.ROLE_OPERATOR
    );
    private static final List<String> WORKFLOW_USER_ROLES = List.of(
            UserContextHolder.ROLE_APPLICANT,
            UserContextHolder.ROLE_MANAGER,
            UserContextHolder.ROLE_FINANCE
    );
    private static final List<String> PROCESS_CONTEXT_ROLES = List.of(
            UserContextHolder.ROLE_ADMIN,
            UserContextHolder.ROLE_APPLICANT,
            UserContextHolder.ROLE_MANAGER,
            UserContextHolder.ROLE_FINANCE,
            UserContextHolder.ROLE_OPERATOR
    );
    private static final List<String> APPROVAL_ROLES = List.of(UserContextHolder.ROLE_MANAGER, UserContextHolder.ROLE_FINANCE);
    private static final List<String> ADMIN_ROLES = List.of(UserContextHolder.ROLE_ADMIN);
    private static final List<String> OPS_ROLES = List.of(UserContextHolder.ROLE_OPERATOR);
    private static final List<String> SYSTEM_ROLES = List.of(UserContextHolder.ROLE_ADMIN, UserContextHolder.ROLE_OPERATOR);
    private static final List<String> AUDIT_ROLES = SYSTEM_ROLES;
    private static final Map<String, List<EndpointRule>> RULES = Map.of(
            "GET", List.of(
                    rule("/api/v1/health", ALL_BUSINESS_ROLES),
                    rule("/api/v1/system/health", SYSTEM_ROLES),
                    rule("/api/v1/dashboard/summary", SYSTEM_ROLES),
                    rule("/api/v1/organization/members", ALL_BUSINESS_ROLES),
                    rule("/api/v1/workflow-enablement/status", ADMIN_ROLES),
                    rule("/api/v1/workflow-enablement/startable-processes", List.of(UserContextHolder.ROLE_APPLICANT)),
                    rule("/api/v1/tasks/my", APPROVAL_ROLES),
                    rule("/api/v1/tasks/candidates", APPROVAL_ROLES),
                    rule("/api/v1/tasks/done", APPROVAL_ROLES),
                    rule("/api/v1/tasks/started", WORKFLOW_USER_ROLES),
                    rule("/api/v1/tasks/[^/]+", WORKFLOW_USER_ROLES),
                    rule("/api/v1/process-instances/[^/]+/trace", PROCESS_CONTEXT_ROLES),
                    rule("/api/v1/process-instances/[^/]+", PROCESS_CONTEXT_ROLES),
                    rule("/api/v1/forms/snapshots", PROCESS_CONTEXT_ROLES),
                    prefix("/api/v1/process-models", ADMIN_ROLES),
                    prefix("/api/v1/forms", ADMIN_ROLES),
                    prefix("/api/v1/form-bindings", ADMIN_ROLES),
                    prefix("/api/v1/datasources", ADMIN_ROLES),
                    prefix("/api/v1/ops", OPS_ROLES),
                    prefix("/api/v1/audit-logs", AUDIT_ROLES),
                    prefix("/api/v1/connector-execution-logs", AUDIT_ROLES)
            ),
            "POST", List.of(
                    rule("/api/v1/auth/login", ALL_BUSINESS_ROLES),
                    rule("/api/v1/auth/logout", ALL_BUSINESS_ROLES),
                    rule("/api/v1/organization/members", ADMIN_ROLES),
                    rule("/api/v1/organization/members/[^/]+/enable", ADMIN_ROLES),
                    rule("/api/v1/organization/members/[^/]+/disable", ADMIN_ROLES),
                    rule("/api/v1/organization/members/[^/]+/reset-password", ADMIN_ROLES),
                    rule("/api/v1/process-instances/start", List.of(UserContextHolder.ROLE_APPLICANT)),
                    rule("/api/v1/tasks/[^/]+/complete", APPROVAL_ROLES),
                    rule("/api/v1/tasks/[^/]+/actions", APPROVAL_ROLES),
                    prefix("/api/v1/process-models", ADMIN_ROLES),
                    prefix("/api/v1/forms", ADMIN_ROLES),
                    prefix("/api/v1/form-bindings", ADMIN_ROLES),
                    prefix("/api/v1/datasources", ADMIN_ROLES),
                    prefix("/api/v1/workflow-enablement", ADMIN_ROLES),
                    prefix("/api/v1/ops", OPS_ROLES),
                    prefix("/api/v1/connector-execution-logs", AUDIT_ROLES)
            ),
            "PUT", List.of(
                    rule("/api/v1/organization/members/[^/]+", ADMIN_ROLES),
                    prefix("/api/v1/process-models", ADMIN_ROLES),
                    prefix("/api/v1/forms", ADMIN_ROLES),
                    prefix("/api/v1/form-bindings", ADMIN_ROLES),
                    prefix("/api/v1/datasources", ADMIN_ROLES)
            ),
            "DELETE", List.of(
                    prefix("/api/v1/form-bindings", ADMIN_ROLES),
                    prefix("/api/v1/datasources", ADMIN_ROLES)
            )
    );

    private RolePermissionMatrix() {
    }

    public static boolean isAllowed(String method, String path, String userId, String role) {
        if (isPublicRequest(method, path)) {
            return true;
        }
        if (UserContextHolder.ANONYMOUS.equals(userId)) {
            return false;
        }
        List<EndpointRule> methodRules = new ArrayList<>(RULES.getOrDefault(method, List.of()));
        if (HttpMethod.HEAD.matches(method)) {
            methodRules.addAll(RULES.getOrDefault("GET", List.of()));
        }
        for (EndpointRule rule : methodRules) {
            if (rule.matches(path)) {
                return rule.roles().contains(role);
            }
        }
        return false;
    }

    public static Map<String, Boolean> capabilitiesForRole(String role) {
        boolean isAdmin = UserContextHolder.ROLE_ADMIN.equals(role);
        boolean isApprover = APPROVAL_ROLES.contains(role);
        boolean isWorkflowUser = UserContextHolder.ROLE_APPLICANT.equals(role) || isApprover;
        boolean isOperator = UserContextHolder.ROLE_OPERATOR.equals(role);
        Map<String, Boolean> capabilities = new LinkedHashMap<>();
        capabilities.put("canAdmin", isAdmin);
        capabilities.put("canViewDashboard", isAdmin || isOperator);
        capabilities.put("canViewOwnWork", isWorkflowUser);
        capabilities.put("canViewProcessContext", isAdmin || isWorkflowUser || isOperator);
        capabilities.put("canStartProcess", UserContextHolder.ROLE_APPLICANT.equals(role));
        capabilities.put("canClaimTask", isApprover);
        capabilities.put("canHandleTask", isApprover);
        capabilities.put("canConfigureWorkflow", isAdmin);
        capabilities.put("canManageOrganization", isAdmin);
        capabilities.put("canManageIntegration", isAdmin);
        capabilities.put("canManageSystem", isAdmin);
        capabilities.put("canViewAudit", isAdmin || isOperator);
        capabilities.put("canOperateSystem", isOperator);
        return capabilities;
    }

    private static boolean isPublicRequest(String method, String path) {
        if (HttpMethod.OPTIONS.matches(method)) {
            return true;
        }
        return path.startsWith("/swagger-ui/")
                || path.equals("/v3/api-docs")
                || path.startsWith("/v3/api-docs/")
                || path.equals("/api/v1/health")
                || path.equals("/api/v1/auth/login");
    }

    private static EndpointRule rule(String pattern, List<String> roles) {
        return new EndpointRule(pattern, roles, false);
    }

    private static EndpointRule prefix(String prefix, List<String> roles) {
        return new EndpointRule(prefix, roles, true);
    }

    private record EndpointRule(String pattern, List<String> roles, boolean prefix) {
        private boolean matches(String path) {
            return prefix ? path.startsWith(pattern) : path.matches(pattern);
        }
    }
}
