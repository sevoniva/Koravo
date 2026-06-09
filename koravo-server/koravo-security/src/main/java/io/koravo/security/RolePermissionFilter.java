package io.koravo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 31)
public class RolePermissionFilter extends OncePerRequestFilter {
    private static final List<String> ALL_BUSINESS_ROLES = List.of(
            UserContextHolder.ROLE_ADMIN,
            UserContextHolder.ROLE_APPLICANT,
            UserContextHolder.ROLE_MANAGER,
            UserContextHolder.ROLE_FINANCE
    );
    private static final List<String> APPROVAL_ROLES = List.of(UserContextHolder.ROLE_MANAGER, UserContextHolder.ROLE_FINANCE);
    private static final List<String> ADMIN_ROLES = List.of(UserContextHolder.ROLE_ADMIN);
    private static final Map<String, List<EndpointRule>> RULES = Map.of(
            "GET", List.of(
                    rule("/api/v1/health", ALL_BUSINESS_ROLES),
                    rule("/api/v1/system/health", ADMIN_ROLES),
                    rule("/api/v1/dashboard/summary", ALL_BUSINESS_ROLES),
                    rule("/api/v1/organization/members", ALL_BUSINESS_ROLES),
                    rule("/api/v1/workflow-enablement/status", ADMIN_ROLES),
                    rule("/api/v1/workflow-enablement/startable-processes", ALL_BUSINESS_ROLES),
                    rule("/api/v1/tasks/my", ALL_BUSINESS_ROLES),
                    rule("/api/v1/tasks/candidates", APPROVAL_ROLES),
                    rule("/api/v1/tasks/done", ALL_BUSINESS_ROLES),
                    rule("/api/v1/tasks/started", ALL_BUSINESS_ROLES),
                    rule("/api/v1/tasks/[^/]+", ALL_BUSINESS_ROLES),
                    rule("/api/v1/process-instances/[^/]+", ALL_BUSINESS_ROLES),
                    rule("/api/v1/forms/snapshots", ALL_BUSINESS_ROLES),
                    prefix("/api/v1/process-models", ADMIN_ROLES),
                    prefix("/api/v1/forms", ADMIN_ROLES),
                    prefix("/api/v1/form-bindings", ADMIN_ROLES),
                    prefix("/api/v1/datasources", ADMIN_ROLES),
                    prefix("/api/v1/ops", ADMIN_ROLES),
                    prefix("/api/v1/audit-logs", ADMIN_ROLES),
                    prefix("/api/v1/connector-execution-logs", ADMIN_ROLES)
            ),
            "POST", List.of(
                    rule("/api/v1/process-instances/start", List.of(UserContextHolder.ROLE_ADMIN, UserContextHolder.ROLE_APPLICANT)),
                    rule("/api/v1/tasks/[^/]+/complete", APPROVAL_ROLES),
                    rule("/api/v1/tasks/[^/]+/actions", APPROVAL_ROLES),
                    prefix("/api/v1/process-models", ADMIN_ROLES),
                    prefix("/api/v1/forms", ADMIN_ROLES),
                    prefix("/api/v1/form-bindings", ADMIN_ROLES),
                    prefix("/api/v1/datasources", ADMIN_ROLES),
                    prefix("/api/v1/workflow-enablement", ADMIN_ROLES),
                    prefix("/api/v1/ops", ADMIN_ROLES)
            ),
            "PUT", List.of(
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

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (isAllowed(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("""
                {"success":false,"code":"FORBIDDEN","message":"当前角色无权执行该操作"}
                """);
    }

    private boolean isAllowed(HttpServletRequest request) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        if (UserContextHolder.ANONYMOUS.equals(UserContextHolder.getUserId())) {
            return true;
        }

        String method = request.getMethod();
        String path = request.getRequestURI();
        List<EndpointRule> methodRules = new java.util.ArrayList<>(RULES.getOrDefault(method, List.of()));
        if (HttpMethod.HEAD.matches(method)) {
            methodRules.addAll(RULES.getOrDefault("GET", List.of()));
        }
        for (EndpointRule rule : methodRules) {
            if (rule.matches(path)) {
                return rule.roles().contains(UserContextHolder.getRole());
            }
        }
        return false;
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
