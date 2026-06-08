package io.koravo.datahub.domain;

import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "ko_datasource_test_log")
public class KoDataSourceTestLog extends BaseEntity {
    @Column(name = "datasource_id", nullable = false, length = 64)
    private String datasourceId;

    @Column(name = "success", nullable = false)
    private boolean success;

    @Column(name = "message", columnDefinition = "text")
    private String message;

    @Column(name = "elapsed_millis", nullable = false)
    private long elapsedMillis;

    public String getDatasourceId() {
        return datasourceId;
    }

    public void setDatasourceId(String datasourceId) {
        this.datasourceId = datasourceId;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public long getElapsedMillis() {
        return elapsedMillis;
    }

    public void setElapsedMillis(long elapsedMillis) {
        this.elapsedMillis = elapsedMillis;
    }
}
