package io.koravo.datahub.web;

public record DataSourceTestResponse(
        boolean connected,
        String message,
        long elapsedMillis
) {
}
