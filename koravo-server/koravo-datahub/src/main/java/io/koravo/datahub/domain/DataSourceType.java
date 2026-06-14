package io.koravo.datahub.domain;

public enum DataSourceType {
    POSTGRESQL("org.postgresql.Driver"),
    MYSQL("com.mysql.cj.jdbc.Driver"),
    H2("org.h2.Driver");

    private final String defaultDriverClassName;

    DataSourceType(String defaultDriverClassName) {
        this.defaultDriverClassName = defaultDriverClassName;
    }

    public String defaultDriverClassName() {
        return defaultDriverClassName;
    }
}
