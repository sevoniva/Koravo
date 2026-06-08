package io.koravo.datahub.domain;

import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "ko_datasource")
public class KoDataSource extends BaseEntity {
    @Column(name = "name", nullable = false, length = 256)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 64)
    private DataSourceType type;

    @Column(name = "jdbc_url", nullable = false, length = 1024)
    private String jdbcUrl;

    @Column(name = "username", length = 256)
    private String username;

    @Column(name = "password_cipher", columnDefinition = "text")
    private String passwordCipher;

    @Column(name = "driver_class_name", nullable = false, length = 256)
    private String driverClassName;

    @Column(name = "read_only", nullable = false)
    private boolean readOnly;

    @Column(name = "pool_config_json", columnDefinition = "text")
    private String poolConfigJson;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 64)
    private DataSourceStatus status;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public DataSourceType getType() {
        return type;
    }

    public void setType(DataSourceType type) {
        this.type = type;
    }

    public String getJdbcUrl() {
        return jdbcUrl;
    }

    public void setJdbcUrl(String jdbcUrl) {
        this.jdbcUrl = jdbcUrl;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPasswordCipher() {
        return passwordCipher;
    }

    public void setPasswordCipher(String passwordCipher) {
        this.passwordCipher = passwordCipher;
    }

    public String getDriverClassName() {
        return driverClassName;
    }

    public void setDriverClassName(String driverClassName) {
        this.driverClassName = driverClassName;
    }

    public boolean isReadOnly() {
        return readOnly;
    }

    public void setReadOnly(boolean readOnly) {
        this.readOnly = readOnly;
    }

    public String getPoolConfigJson() {
        return poolConfigJson;
    }

    public void setPoolConfigJson(String poolConfigJson) {
        this.poolConfigJson = poolConfigJson;
    }

    public DataSourceStatus getStatus() {
        return status;
    }

    public void setStatus(DataSourceStatus status) {
        this.status = status;
    }
}
