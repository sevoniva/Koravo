package io.koravo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 31)
public class RolePermissionFilter extends OncePerRequestFilter {
    private final ApplicationEventPublisher eventPublisher;

    public RolePermissionFilter(ApplicationEventPublisher eventPublisher) {
        this.eventPublisher = eventPublisher;
    }

    RolePermissionFilter() {
        this(event -> {
        });
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (RolePermissionMatrix.isAllowed(
                request.getMethod(),
                request.getRequestURI(),
                UserContextHolder.getUserId(),
                UserContextHolder.getRole()
        )) {
            filterChain.doFilter(request, response);
            return;
        }
        eventPublisher.publishEvent(new AccessDeniedAuditEvent(
                request.getMethod(),
                request.getRequestURI(),
                UserContextHolder.getUserId(),
                UserContextHolder.getRole()
        ));
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("""
                {"success":false,"code":"FORBIDDEN","message":"当前角色无权执行该操作"}
                """);
    }
}
