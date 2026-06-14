package io.koravo.bootstrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@EntityScan("io.koravo")
@EnableJpaRepositories("io.koravo")
@SpringBootApplication(scanBasePackages = "io.koravo")
public class KoravoApplication {
    public static void main(String[] args) {
        SpringApplication.run(KoravoApplication.class, args);
    }
}
