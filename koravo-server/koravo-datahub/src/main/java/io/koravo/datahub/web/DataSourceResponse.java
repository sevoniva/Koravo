package io.koravo.datahub.web;

public record DataSourceResponse(
        String id,
        String name,
        String type,
        String jdbcUrl,
        String username,
        String driverClassName,
        boolean readOnly,
        String poolConfigJson,
        String status
) {
}
