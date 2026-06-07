package io.koravo.api.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI koravoOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Koravo 平台 API")
                .version("0.1.0")
                .description("基于 Flowable 的流程与数据编排平台接口。所有接口默认使用 /api/v1，并通过 X-Tenant-Id、X-User-Id 传递开发期租户和用户上下文。"));
    }
}
