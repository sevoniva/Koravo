package io.koravo.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;

class PlatformAuthenticationFilterTest {
    @AfterEach
    void tearDown() {
        UserContextHolder.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void usesTrustedPlatformHeadersForCurrentUser() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter("");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
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
    void leavesRequestUnauthenticatedWhenPlatformUserIsMissing() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter("");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            assertThat(UserContextHolder.getUserId()).isEqualTo(UserContextHolder.ANONYMOUS);
            assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        });

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void rejectsInvalidPlatformToken() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter("trusted-token");
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
}
