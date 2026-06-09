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
    public static final String HEADER_USER_ID = "X-Koravo-User-Id";
    public static final String HEADER_USER_ROLE = "X-Koravo-User-Role";
    public static final String HEADER_PLATFORM_TOKEN = "X-Koravo-Platform-Token";

    private final String trustedToken;

    public PlatformAuthenticationFilter(
            @Value("${koravo.security.platform-token:}") String trustedToken
    ) {
        this.trustedToken = trustedToken == null ? "" : trustedToken.trim();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String userId = request.getHeader(HEADER_USER_ID);
            if (userId == null || userId.isBlank()) {
                filterChain.doFilter(request, response);
                return;
            }
            if (!hasTrustedPlatformToken(request)) {
                unauthorized(response);
                return;
            }

            UserContextHolder.setUser(userId, request.getHeader(HEADER_USER_ROLE));
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(
                            UserContextHolder.getUserId(),
                            "N/A",
                            AuthorityUtils.createAuthorityList("ROLE_USER", "ROLE_" + UserContextHolder.getRole().toUpperCase())
                    )
            );
            filterChain.doFilter(request, response);
        } finally {
            UserContextHolder.clear();
            SecurityContextHolder.clearContext();
        }
    }

    private boolean hasTrustedPlatformToken(HttpServletRequest request) {
        if (trustedToken.isBlank()) {
            return true;
        }
        String requestToken = request.getHeader(HEADER_PLATFORM_TOKEN);
        return trustedToken.equals(requestToken);
    }

    private void unauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("""
                {"success":false,"code":"UNAUTHORIZED","message":"平台身份凭证无效"}
                """);
    }
}
