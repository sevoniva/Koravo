package io.koravo.api.organization;

import jakarta.validation.constraints.NotBlank;

public record OrganizationMemberPasswordRequest(
        @NotBlank(message = "请输入新密码") String password
) {
}
