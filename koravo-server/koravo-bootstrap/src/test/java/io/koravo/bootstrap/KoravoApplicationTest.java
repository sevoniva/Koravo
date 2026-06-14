package io.koravo.bootstrap;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

class KoravoApplicationTest {
    @Test
    void scansEntitiesAndJpaRepositoriesAcrossKoravoModules() {
        EntityScan entityScan = KoravoApplication.class.getAnnotation(EntityScan.class);
        EnableJpaRepositories repositories =
                KoravoApplication.class.getAnnotation(EnableJpaRepositories.class);

        assertThat(entityScan).isNotNull();
        assertThat(entityScan.value()).containsExactly("io.koravo");
        assertThat(repositories).isNotNull();
        assertThat(repositories.value()).containsExactly("io.koravo");
    }
}
