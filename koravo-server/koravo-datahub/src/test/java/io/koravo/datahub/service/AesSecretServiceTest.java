package io.koravo.datahub.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AesSecretServiceTest {
    @Test
    void encryptsAndDecryptsSecret() {
        AesSecretService service = new AesSecretService("test-secret");

        String cipher = service.encrypt("koravo");

        assertThat(cipher).isNotEqualTo("koravo");
        assertThat(service.decrypt(cipher)).isEqualTo("koravo");
    }
}
