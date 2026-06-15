package io.koravo.api.organization;

public record OrganizationDirectoryMemberResponse(
        String userId,
        String name,
        String department,
        String role,
        String status
) {
}
