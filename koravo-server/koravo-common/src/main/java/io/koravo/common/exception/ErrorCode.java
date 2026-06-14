package io.koravo.common.exception;

public enum ErrorCode {
    OK("OK", "success"),
    BAD_REQUEST("BAD_REQUEST", "请求参数无效"),
    UNAUTHORIZED("UNAUTHORIZED", "未登录或无权访问"),
    TENANT_REQUIRED("TENANT_REQUIRED", "缺少租户标识"),
    MODEL_NOT_FOUND("MODEL_NOT_FOUND", "流程模型不存在"),
    PROCESS_DEPLOY_FAILED("PROCESS_DEPLOY_FAILED", "流程部署失败"),
    PROCESS_INSTANCE_NOT_FOUND("PROCESS_INSTANCE_NOT_FOUND", "流程实例不存在"),
    TASK_NOT_FOUND("TASK_NOT_FOUND", "任务不存在或不属于当前用户"),
    FORM_SCHEMA_NOT_FOUND("FORM_SCHEMA_NOT_FOUND", "表单不存在"),
    FORM_BINDING_NOT_FOUND("FORM_BINDING_NOT_FOUND", "表单绑定不存在"),
    DATASOURCE_NOT_FOUND("DATASOURCE_NOT_FOUND", "数据源不存在"),
    DATASOURCE_TEST_FAILED("DATASOURCE_TEST_FAILED", "数据源连接测试失败"),
    INTERNAL_ERROR("INTERNAL_ERROR", "服务内部错误");

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
