package io.koravo.security;

import io.koravo.common.web.RequestContextHolder;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 31)
public class RolePermissionFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(RolePermissionFilter.class);

    private final ObjectProvider<AccessDeniedAuditRecorder> auditRecorderProvider;
    private final List<AccessDeniedAuditRecorder> fixedAuditRecorders;
    private final String defaultTenantId;

    @Autowired
    public RolePermissionFilter(
            ObjectProvider<AccessDeniedAuditRecorder> auditRecorders,
            @Value("${koravo.tenant.platform-tenant-id:default}") String defaultTenantId
    ) {
        this.auditRecorderProvider = auditRecorders;
        this.fixedAuditRecorders = null;
        this.defaultTenantId = defaultTenantId == null || defaultTenantId.isBlank() ? "default" : defaultTenantId.trim();
    }

    RolePermissionFilter(List<AccessDeniedAuditRecorder> auditRecorders) {
        this.auditRecorderProvider = null;
        this.fixedAuditRecorders = auditRecorders == null ? List.of() : List.copyOf(auditRecorders);
        this.defaultTenantId = "default";
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
        AccessDeniedAuditEvent event = new AccessDeniedAuditEvent(
                request.getMethod(),
                request.getRequestURI(),
                UserContextHolder.getUserId(),
                UserContextHolder.getRole(),
                tenantId(request),
                RequestContextHolder.getRequestId(),
                RequestContextHolder.getClientIp()
        );
        recordAccessDenied(event);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("""
                {"success":false,"code":"FORBIDDEN","message":"当前角色无权执行该操作"}
                """);
    }

    private void recordAccessDenied(AccessDeniedAuditEvent event) {
        for (AccessDeniedAuditRecorder recorder : currentAuditRecorders()) {
            try {
                recorder.recordAccessDenied(event);
            } catch (RuntimeException ex) {
                log.warn("Failed to record access denied audit for {} {}", event.method(), event.path(), ex);
            }
        }
    }

    private List<AccessDeniedAuditRecorder> currentAuditRecorders() {
        if (fixedAuditRecorders != null) {
            return fixedAuditRecorders;
        }
        return auditRecorderProvider.orderedStream().toList();
    }

    private String tenantId(HttpServletRequest request) {
        String tenantId = request.getHeader("X-Koravo-Tenant-Id");
        return tenantId == null || tenantId.isBlank() ? defaultTenantId : tenantId.trim();
    }
}
