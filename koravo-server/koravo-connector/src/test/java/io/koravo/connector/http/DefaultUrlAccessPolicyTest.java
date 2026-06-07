package io.koravo.connector.http;

import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

class DefaultUrlAccessPolicyTest {
    private final DefaultUrlAccessPolicy policy = new DefaultUrlAccessPolicy();

    @Test
    void allowsHttpsAndLocalhost() {
        assertThat(policy.isAllowed(URI.create("https://api.example.com/users"))).isTrue();
        assertThat(policy.isAllowed(URI.create("http://localhost:8080/mock"))).isTrue();
        assertThat(policy.isAllowed(URI.create("http://127.0.0.1:8080/mock"))).isTrue();
    }

    @Test
    void blocksPlainHttpAndDangerousPrivateHosts() {
        assertThat(policy.isAllowed(URI.create("http://example.com"))).isFalse();
        assertThat(policy.isAllowed(URI.create("http://10.0.0.8/internal"))).isFalse();
        assertThat(policy.isAllowed(URI.create("https://192.168.1.8/internal"))).isFalse();
        assertThat(policy.isAllowed(URI.create("https://169.254.169.254/latest/meta-data"))).isFalse();
    }
}
