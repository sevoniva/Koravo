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

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 31)
public class RolePermissionFilter extends OncePerRequestFilter {
    private static final List<String> ADMIN_WRITE_PREFIXES = List.of(
            "/api/v1/process-models",
            "/api/v1/forms/schemas",
            "/api/v1/form-bindings",
            "/api/v1/datasources",
            "/api/v1/workflow-enablement",
            "/api/v1/ops"
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
        if (HttpMethod.OPTIONS.matches(request.getMethod())
                || HttpMethod.GET.matches(request.getMethod())
                || HttpMethod.HEAD.matches(request.getMethod())) {
            return true;
        }
        if (UserContextHolder.hasRole(UserContextHolder.ROLE_ADMIN)) {
            return true;
        }

        String path = request.getRequestURI();
        if (HttpMethod.POST.matches(request.getMethod()) && "/api/v1/process-instances/start".equals(path)) {
            return UserContextHolder.hasRole(UserContextHolder.ROLE_APPLICANT);
        }
        if (HttpMethod.POST.matches(request.getMethod()) && path.matches("/api/v1/tasks/[^/]+/complete")) {
            return UserContextHolder.hasRole(UserContextHolder.ROLE_MANAGER, UserContextHolder.ROLE_FINANCE);
        }
        return ADMIN_WRITE_PREFIXES.stream().noneMatch(path::startsWith);
    }
}
