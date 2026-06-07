package io.koravo.common.api;

import io.koravo.common.web.RequestContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ApiResponseTest {
    @AfterEach
    void tearDown() {
        RequestContextHolder.clear();
    }

    @Test
    void successUsesStandardShapeAndCurrentRequestId() {
        RequestContextHolder.set("req-1", "127.0.0.1");

        ApiResponse<String> response = ApiResponse.success("pong");

        assertThat(response.success()).isTrue();
        assertThat(response.code()).isEqualTo("OK");
        assertThat(response.message()).isEqualTo("success");
        assertThat(response.data()).isEqualTo("pong");
        assertThat(response.requestId()).isEqualTo("req-1");
    }
}
