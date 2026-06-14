package io.koravo.common.exception;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ErrorCodeTest {
    @Test
    void okCodeMatchesResponseContract() {
        assertThat(ErrorCode.OK.code()).isEqualTo("OK");
        assertThat(ErrorCode.OK.message()).isEqualTo("success");
    }
}
