package io.koravo.api.organization;

import jakarta.validation.constraints.NotBlank;

public record OrganizationMemberUpsertRequest(
        @NotBlank(message = "请输入成员账号") String userId,
        @NotBlank(message = "请输入成员姓名") String name,
        @NotBlank(message = "请输入所属部门") String department,
        @NotBlank(message = "请选择岗位职责") String role,
        String status,
        String password
) {
}
