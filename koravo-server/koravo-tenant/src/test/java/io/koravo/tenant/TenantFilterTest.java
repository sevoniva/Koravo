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
    void usesPlatformTenantHeaderWhenPresent() throws Exception {
        TenantFilter filter = new TenantFilter("default");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        request.addHeader(TenantFilter.HEADER_TENANT_ID, "other-org");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) ->
                assertThat(TenantContextHolder.getTenantId()).isEqualTo("other-org")
        );

        assertThat(TenantContextHolder.getTenantId()).isEqualTo(TenantContextHolder.DEFAULT_TENANT);
    }

    @Test
    void fallsBackToConfiguredTenantWhenPlatformTenantIsMissing() throws Exception {
        TenantFilter filter = new TenantFilter("default");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/health");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) ->
                assertThat(TenantContextHolder.getTenantId()).isEqualTo("default")
        );

        assertThat(TenantContextHolder.getTenantId()).isEqualTo(TenantContextHolder.DEFAULT_TENANT);
    }
}
