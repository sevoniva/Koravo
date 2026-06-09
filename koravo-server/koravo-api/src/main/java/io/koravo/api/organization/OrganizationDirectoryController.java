package io.koravo.api.organization;

import io.koravo.common.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class OrganizationDirectoryController {
    private final OrganizationDirectoryService organizationDirectoryService;

    public OrganizationDirectoryController(OrganizationDirectoryService organizationDirectoryService) {
        this.organizationDirectoryService = organizationDirectoryService;
    }

    @GetMapping("/api/v1/organization/members")
    public ApiResponse<List<OrganizationMemberResponse>> members() {
        return ApiResponse.success(organizationDirectoryService.members());
    }
}
