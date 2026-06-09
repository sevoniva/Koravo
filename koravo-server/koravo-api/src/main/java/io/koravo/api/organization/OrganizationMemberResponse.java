package io.koravo.api.organization;

public record OrganizationMemberResponse(
        String key,
        String tenantId,
        String userId,
        String name,
        String department,
        String role,
        String status
) {
}
