package io.koravo.datahub.web;

import io.koravo.datahub.domain.DataSourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record DataSourceCreateRequest(
        @NotBlank String name,
        @NotNull DataSourceType type,
        @NotBlank String jdbcUrl,
        String username,
        String password,
        String driverClassName,
        boolean readOnly,
        String poolConfigJson
) {
}
