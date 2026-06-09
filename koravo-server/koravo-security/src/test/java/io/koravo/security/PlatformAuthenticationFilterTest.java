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
    void usesConfiguredPlatformUserInsteadOfRequestHeaders() throws Exception {
        PlatformAuthenticationFilter filter = new PlatformAuthenticationFilter("admin", "admin");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        request.addHeader("X-User-Id", "finance");
        request.addHeader("X-User-Role", "finance");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            assertThat(UserContextHolder.getUserId()).isEqualTo("admin");
            assertThat(UserContextHolder.getRole()).isEqualTo("admin");
            assertThat(SecurityContextHolder.getContext().getAuthentication().getName()).isEqualTo("admin");
        });

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(UserContextHolder.getUserId()).isEqualTo(UserContextHolder.ANONYMOUS);
    }
}
