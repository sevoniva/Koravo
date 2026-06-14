package io.koravo.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class PlatformAuthenticationFilterTest {
    @AfterEach
    void tearDown() {
        UserContextHolder.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void usesTrustedPlatformHeadersForCurrentUser() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter(
                "",
                true,
                "default",
                PlatformIdentityVerifier.allowAll()
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/tasks/my");
        request.addHeader(PlatformAuthenticationFilter.HEADER_USER_ID, "finance");
        request.addHeader(PlatformAuthenticationFilter.HEADER_USER_ROLE, "finance");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            assertThat(UserContextHolder.getUserId()).isEqualTo("finance");
            assertThat(UserContextHolder.getRole()).isEqualTo("finance");
            assertThat(SecurityContextHolder.getContext().getAuthentication().getName()).isEqualTo("finance");
        });

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(UserContextHolder.getUserId()).isEqualTo(UserContextHolder.ANONYMOUS);
    }

    @Test
    void rejectsRequestWhenPlatformUserIsMissing() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter(
                "",
                false,
                "default",
                PlatformIdentityVerifier.allowAll()
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/tasks/my");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            throw new AssertionError("missing platform identity must stop the request");
        });

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("平台身份缺失");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void keepsApiDocsPublicWithoutPlatformIdentity() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter(
                "",
                false,
                "default",
                PlatformIdentityVerifier.allowAll()
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/v3/api-docs");
        request.setRequestURI("/v3/api-docs");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) ->
                assertThat(UserContextHolder.getUserId()).isEqualTo(UserContextHolder.ANONYMOUS)
        );

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void keepsBasicHealthPublicWithoutPlatformIdentity() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter(
                "",
                false,
                "default",
                PlatformIdentityVerifier.allowAll()
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        request.setRequestURI("/api/v1/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) ->
                assertThat(UserContextHolder.getUserId()).isEqualTo(UserContextHolder.ANONYMOUS)
        );

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void keepsLoginPublicWithoutPlatformIdentity() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter(
                "",
                false,
                "default",
                PlatformIdentityVerifier.allowAll()
        );
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.setRequestURI("/api/v1/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) ->
                assertThat(UserContextHolder.getUserId()).isEqualTo(UserContextHolder.ANONYMOUS)
        );

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void usesBearerSessionTokenBeforePlatformHeaders() throws Exception {
        PlatformIdentityVerifier verifier = new PlatformIdentityVerifier() {
            @Override
            public Optional<VerifiedPlatformIdentity> verify(PlatformIdentityRequest request) {
                return Optional.empty();
            }

            @Override
            public Optional<VerifiedPlatformIdentity> verifyToken(String token) {
                return "session-token".equals(token)
                        ? Optional.of(new VerifiedPlatformIdentity("default", "manager", UserContextHolder.ROLE_MANAGER))
                        : Optional.empty();
            }
        };
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter(
                "",
                false,
                "default",
                verifier
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        request.addHeader(PlatformAuthenticationFilter.HEADER_AUTHORIZATION, "Bearer session-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            assertThat(UserContextHolder.getUserId()).isEqualTo("manager");
            assertThat(UserContextHolder.getRole()).isEqualTo(UserContextHolder.ROLE_MANAGER);
        });

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void rejectsBearerSessionFromAnotherTenant() throws Exception {
        PlatformIdentityVerifier verifier = new PlatformIdentityVerifier() {
            @Override
            public Optional<VerifiedPlatformIdentity> verify(PlatformIdentityRequest request) {
                return Optional.empty();
            }

            @Override
            public Optional<VerifiedPlatformIdentity> verifyToken(String token) {
                return Optional.of(new VerifiedPlatformIdentity("tenant-b", "manager", UserContextHolder.ROLE_MANAGER));
            }
        };
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter(
                "",
                false,
                "default",
                verifier
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        request.addHeader(PlatformAuthenticationFilter.HEADER_AUTHORIZATION, "Bearer session-token");
        request.addHeader("X-Koravo-Tenant-Id", "tenant-a");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            throw new AssertionError("cross-tenant session must stop the request");
        });

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("登录会话不属于当前组织");
    }

    @Test
    void rejectsInvalidPlatformToken() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter(
                "trusted-token",
                false,
                "default",
                PlatformIdentityVerifier.allowAll()
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        request.addHeader(PlatformAuthenticationFilter.HEADER_USER_ID, "manager");
        request.addHeader(PlatformAuthenticationFilter.HEADER_USER_ROLE, "manager");
        request.addHeader(PlatformAuthenticationFilter.HEADER_PLATFORM_TOKEN, "wrong-token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            throw new AssertionError("invalid platform token must stop the request");
        });

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void rejectsUnsignedPlatformHeadersUnlessDevModeAllowsThem() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter(
                "",
                false,
                "default",
                PlatformIdentityVerifier.allowAll()
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        request.addHeader(PlatformAuthenticationFilter.HEADER_USER_ID, "manager");
        request.addHeader(PlatformAuthenticationFilter.HEADER_USER_ROLE, "manager");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            throw new AssertionError("unsigned platform headers must be rejected outside dev mode");
        });

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void rejectsPlatformIdentityMissingFromTenantDirectory() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter(
                "trusted-token",
                false,
                "default",
                request -> java.util.Optional.empty()
        );
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        request.addHeader(PlatformAuthenticationFilter.HEADER_USER_ID, "outside-user");
        request.addHeader(PlatformAuthenticationFilter.HEADER_USER_ROLE, "manager");
        request.addHeader(PlatformAuthenticationFilter.HEADER_PLATFORM_TOKEN, "trusted-token");
        request.addHeader("X-Koravo-Tenant-Id", "tenant-a");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            throw new AssertionError("unknown tenant identity must stop the request");
        });

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("平台身份未同步到当前租户");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
