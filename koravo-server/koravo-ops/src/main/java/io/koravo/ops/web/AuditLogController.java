package io.koravo.ops.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.api.PageResult;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.dto.AuditLogResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
public class AuditLogController {
    private final AuditLogQueryService auditLogQueryService;

    public AuditLogController(AuditLogQueryService auditLogQueryService) {
        this.auditLogQueryService = auditLogQueryService;
    }

    @GetMapping("/api/v1/audit-logs")
    public ApiResponse<PageResult<AuditLogResponse>> query(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String resourceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endTime,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.success(auditLogQueryService.query(userId, action, resourceType, resourceId, startTime, endTime, page, pageSize));
    }
}
