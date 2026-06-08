package io.koravo.connector.domain;

import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "ko_connector_execution_log")
public class KoConnectorExecutionLog extends BaseEntity {
    @Column(name = "connector_type", nullable = false, length = 64)
    private String connectorType;

    @Column(name = "method", length = 16)
    private String method;

    @Column(name = "url", length = 1024)
    private String url;

    @Column(name = "status", nullable = false, length = 32)
    private String status;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "elapsed_millis", nullable = false)
    private long elapsedMillis;

    @Column(name = "request_id", length = 128)
    private String requestId;

    @Column(name = "request_summary", columnDefinition = "text")
    private String requestSummary;

    @Column(name = "response_summary", columnDefinition = "text")
    private String responseSummary;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    public String getConnectorType() {
        return connectorType;
    }

    public void setConnectorType(String connectorType) {
        this.connectorType = connectorType;
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getStatusCode() {
        return statusCode;
    }

    public void setStatusCode(Integer statusCode) {
        this.statusCode = statusCode;
    }

    public long getElapsedMillis() {
        return elapsedMillis;
    }

    public void setElapsedMillis(long elapsedMillis) {
        this.elapsedMillis = elapsedMillis;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public String getRequestSummary() {
        return requestSummary;
    }

    public void setRequestSummary(String requestSummary) {
        this.requestSummary = requestSummary;
    }

    public String getResponseSummary() {
        return responseSummary;
    }

    public void setResponseSummary(String responseSummary) {
        this.responseSummary = responseSummary;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
}
