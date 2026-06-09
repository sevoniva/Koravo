package io.koravo.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 30)
public class PlatformAuthenticationFilter extends OncePerRequestFilter {
    public static final String HEADER_USER_ID = "X-Koravo-User-Id";
    public static final String HEADER_USER_ROLE = "X-Koravo-User-Role";
    public static final String HEADER_PLATFORM_TOKEN = "X-Koravo-Platform-Token";

    private final String trustedToken;
    private final boolean allowUnsignedPlatformHeaders;
    private final String defaultTenantId;
    private final PlatformIdentityVerifier identityVerifier;

    @Autowired
    public PlatformAuthenticationFilter(
            @Value("${koravo.security.platform-token:}") String trustedToken,
            @Value("${koravo.security.allow-unsigned-platform-headers:false}") boolean allowUnsignedPlatformHeaders,
            @Value("${koravo.tenant.platform-tenant-id:default}") String defaultTenantId,
            ObjectProvider<PlatformIdentityVerifier> identityVerifierProvider
    ) {
        this(
                trustedToken,
                allowUnsignedPlatformHeaders,
                defaultTenantId,
                identityVerifierProvider.getIfAvailable(PlatformIdentityVerifier::allowAll)
        );
    }

    PlatformAuthenticationFilter(
            String trustedToken,
            boolean allowUnsignedPlatformHeaders,
            String defaultTenantId,
            PlatformIdentityVerifier identityVerifier
    ) {
        this.trustedToken = trustedToken == null ? "" : trustedToken.trim();
        this.allowUnsignedPlatformHeaders = allowUnsignedPlatformHeaders;
        this.defaultTenantId = defaultTenantId == null || defaultTenantId.isBlank() ? "default" : defaultTenantId.trim();
        this.identityVerifier = identityVerifier;
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

            Optional<VerifiedPlatformIdentity> verifiedIdentity = identityVerifier.verify(new PlatformIdentityRequest(
                    tenantId(request),
                    userId.trim(),
                    request.getHeader(HEADER_USER_ROLE)
            ));
            if (verifiedIdentity.isEmpty()) {
                unauthorized(response, "平台身份未同步到当前租户");
                return;
            }

            VerifiedPlatformIdentity identity = verifiedIdentity.get();
            UserContextHolder.setUser(identity.userId(), identity.role());
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
            return allowUnsignedPlatformHeaders;
        }
        String requestToken = request.getHeader(HEADER_PLATFORM_TOKEN);
        return trustedToken.equals(requestToken);
    }

    private void unauthorized(HttpServletResponse response) throws IOException {
        unauthorized(response, "平台身份凭证无效");
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("""
                {"success":false,"code":"UNAUTHORIZED","message":"%s"}
                """.formatted(message));
    }

    private String tenantId(HttpServletRequest request) {
        String tenantId = request.getHeader("X-Koravo-Tenant-Id");
        return tenantId == null || tenantId.isBlank() ? defaultTenantId : tenantId.trim();
    }
}
