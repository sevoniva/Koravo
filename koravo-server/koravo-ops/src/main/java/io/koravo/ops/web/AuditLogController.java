package io.koravo.ops.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.api.PageResult;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.ops.audit.dto.AuditLogResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class AuditLogController {
    private final AuditLogQueryService auditLogQueryService;
    private final AuditLogService auditLogService;

    public AuditLogController(AuditLogQueryService auditLogQueryService, AuditLogService auditLogService) {
        this.auditLogQueryService = auditLogQueryService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/api/v1/audit-logs")
    public ApiResponse<PageResult<AuditLogResponse>> query(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String resourceId,
            @RequestParam(required = false) String requestId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endTime,
            @RequestParam(defaultValue = "false") boolean includeNonProduction,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.success(auditLogQueryService.query(userId, action, resourceType, resourceId, requestId, startTime, endTime, page, pageSize, includeNonProduction));
    }

    @PostMapping("/api/v1/ops/verification-data/audit-cleanup")
    public ApiResponse<Map<String, Integer>> cleanupVerificationAuditNoise() {
        return ApiResponse.success(Map.of("deletedCount", auditLogService.cleanupVerificationNoise()));
    }
}
