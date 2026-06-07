package io.koravo.bootstrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "io.koravo")
public class KoravoApplication {
    public static void main(String[] args) {
        SpringApplication.run(KoravoApplication.class, args);
    }
}
