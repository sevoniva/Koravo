package io.koravo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 30)
public class PlatformAuthenticationFilter extends OncePerRequestFilter {
    private final String userId;
    private final String role;

    public PlatformAuthenticationFilter(
            @Value("${koravo.security.platform-user-id:admin}") String userId,
            @Value("${koravo.security.platform-user-role:admin}") String role
    ) {
        this.userId = userId;
        this.role = role;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        UserContextHolder.setUser(userId, role);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        UserContextHolder.getUserId(),
                        "N/A",
                        AuthorityUtils.createAuthorityList("ROLE_USER", "ROLE_" + UserContextHolder.getRole().toUpperCase())
                )
        );
        try {
            filterChain.doFilter(request, response);
        } finally {
            UserContextHolder.clear();
            SecurityContextHolder.clearContext();
        }
    }
}
