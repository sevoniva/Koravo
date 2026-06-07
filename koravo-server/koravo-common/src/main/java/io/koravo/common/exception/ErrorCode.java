package io.koravo.common.exception;

public enum ErrorCode {
    OK("OK", "success"),
    BAD_REQUEST("BAD_REQUEST", "Bad request"),
    UNAUTHORIZED("UNAUTHORIZED", "Unauthorized"),
    TENANT_REQUIRED("TENANT_REQUIRED", "Tenant is required"),
    MODEL_NOT_FOUND("MODEL_NOT_FOUND", "Process model not found"),
    PROCESS_DEPLOY_FAILED("PROCESS_DEPLOY_FAILED", "Process deployment failed"),
    PROCESS_INSTANCE_NOT_FOUND("PROCESS_INSTANCE_NOT_FOUND", "Process instance not found"),
    TASK_NOT_FOUND("TASK_NOT_FOUND", "Task not found"),
    FORM_SCHEMA_NOT_FOUND("FORM_SCHEMA_NOT_FOUND", "Form schema not found"),
    FORM_BINDING_NOT_FOUND("FORM_BINDING_NOT_FOUND", "Form binding not found"),
    DATASOURCE_NOT_FOUND("DATASOURCE_NOT_FOUND", "Datasource not found"),
    DATASOURCE_TEST_FAILED("DATASOURCE_TEST_FAILED", "Datasource connection test failed"),
    INTERNAL_ERROR("INTERNAL_ERROR", "Internal server error");

    private final String code;
    private final String message;

    ErrorCode(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String code() {
        return code;
    }

    public String message() {
        return message;
    }
}
