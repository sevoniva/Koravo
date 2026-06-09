package io.koravo.tenant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class TenantFilterTest {
    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void usesConfiguredTenantInsteadOfRequestHeader() throws Exception {
        TenantFilter filter = new TenantFilter("default");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        request.addHeader("X-Tenant-Id", "other-org");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) ->
                assertThat(TenantContextHolder.getTenantId()).isEqualTo("default")
        );

        assertThat(TenantContextHolder.getTenantId()).isEqualTo(TenantContextHolder.DEFAULT_TENANT);
    }
}
