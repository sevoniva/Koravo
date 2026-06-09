package io.koravo.api.auth;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        String tenantId,
        @NotBlank(message = "请输入成员账号") String userId,
        @NotBlank(message = "请输入登录密码") String password
) {
}
