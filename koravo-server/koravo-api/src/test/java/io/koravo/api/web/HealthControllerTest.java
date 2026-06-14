package io.koravo.api.web;

import io.koravo.common.web.RequestContextHolder;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HealthControllerTest {
    @AfterEach
    void tearDown() {
        RequestContextHolder.clear();
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void healthReturnsRuntimeContext() {
        RequestContextHolder.set("req-health", "127.0.0.1");
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");

        HealthController controller = new HealthController();
        var response = controller.health();

        assertThat(response.success()).isTrue();
        assertThat(response.data()).containsEntry("status", "UP");
        assertThat(response.data()).containsEntry("tenantId", "default");
        assertThat(response.data()).containsEntry("userId", "admin");
        assertThat(response.data()).containsEntry("role", "admin");
        assertThat(response.data().get("permissions"))
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("canConfigureWorkflow", true)
                .containsEntry("canViewProcessContext", true)
                .containsEntry("canViewAudit", true)
                .containsEntry("canOperateSystem", false);
        assertThat(response.requestId()).isEqualTo("req-health");
    }

    @Test
    void healthDoesNotPromoteAnonymousRequestsToApplicant() {
        RequestContextHolder.set("req-public-health", "127.0.0.1");
        TenantContextHolder.setTenantId("default");

        HealthController controller = new HealthController();
        var response = controller.health();

        assertThat(response.success()).isTrue();
        assertThat(response.data()).containsEntry("userId", UserContextHolder.ANONYMOUS);
        assertThat(response.data()).containsEntry("role", UserContextHolder.ROLE_ANONYMOUS);
        assertThat(response.data().get("permissions"))
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .allSatisfy((key, value) -> assertThat(value).as(key.toString()).isEqualTo(false));
        assertThat(response.requestId()).isEqualTo("req-public-health");
    }
}
