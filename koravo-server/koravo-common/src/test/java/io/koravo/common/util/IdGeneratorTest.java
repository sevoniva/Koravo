package io.koravo.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IdGeneratorTest {
    @Test
    void nextIdReturnsCompactUuid() {
        String id = IdGenerator.nextId();

        assertThat(id).hasSize(32);
        assertThat(id).doesNotContain("-");
    }
}
