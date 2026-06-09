package io.koravo.api.organization;

import io.koravo.common.api.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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

    @PostMapping("/api/v1/organization/members")
    public ApiResponse<OrganizationMemberResponse> create(@Valid @RequestBody OrganizationMemberUpsertRequest request) {
        return ApiResponse.success(organizationDirectoryService.create(request));
    }

    @PutMapping("/api/v1/organization/members/{memberId}")
    public ApiResponse<OrganizationMemberResponse> update(
            @PathVariable String memberId,
            @Valid @RequestBody OrganizationMemberUpsertRequest request
    ) {
        return ApiResponse.success(organizationDirectoryService.update(memberId, request));
    }

    @PostMapping("/api/v1/organization/members/{memberId}/enable")
    public ApiResponse<OrganizationMemberResponse> enable(@PathVariable String memberId) {
        return ApiResponse.success(organizationDirectoryService.enable(memberId));
    }

    @PostMapping("/api/v1/organization/members/{memberId}/disable")
    public ApiResponse<OrganizationMemberResponse> disable(@PathVariable String memberId) {
        return ApiResponse.success(organizationDirectoryService.disable(memberId));
    }

    @PostMapping("/api/v1/organization/members/{memberId}/reset-password")
    public ApiResponse<OrganizationMemberResponse> resetPassword(
            @PathVariable String memberId,
            @Valid @RequestBody OrganizationMemberPasswordRequest request
    ) {
        return ApiResponse.success(organizationDirectoryService.resetPassword(memberId, request.password()));
    }
}
