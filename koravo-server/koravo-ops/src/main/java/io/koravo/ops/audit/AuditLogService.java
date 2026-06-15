package io.koravo.ops.audit;

import io.koravo.common.util.JsonUtils;
import io.koravo.common.web.RequestContextHolder;
import io.koravo.common.workflow.RuntimeVisibilityPolicy;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class AuditLogService {
    private final AuditLogRepository repository;
    private final JdbcTemplate jdbcTemplate;

    public AuditLogService(AuditLogRepository repository, JdbcTemplate jdbcTemplate) {
        this.repository = repository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String action, String resourceType, String resourceId, Object detail) {
        AuditLog auditLog = new AuditLog();
        auditLog.setTenantId(TenantContextHolder.getTenantId());
        auditLog.setCreatedBy(UserContextHolder.getUserId());
        auditLog.setUpdatedBy(UserContextHolder.getUserId());
        auditLog.setUserId(UserContextHolder.getUserId());
        auditLog.setAction(action);
        auditLog.setResourceType(resourceType);
        auditLog.setResourceId(resourceId);
        auditLog.setRequestId(RequestContextHolder.getRequestId());
        auditLog.setClientIp(RequestContextHolder.getClientIp());
        auditLog.setDetailJson(redact(detail == null ? "{}" : JsonUtils.toJson(detail)));
        repository.save(auditLog);
    }

    @Transactional
    public int cleanupVerificationNoise() {
        List<Object> args = new ArrayList<>();
        args.add(TenantContextHolder.getTenantId());
        List<String> conditions = new ArrayList<>();
        hiddenAuditLikePatterns().forEach(pattern -> {
            conditions.add("request_id like ?");
            args.add(pattern);
            conditions.add("resource_id like ?");
            args.add(pattern);
            conditions.add("detail_json like ?");
            args.add(pattern);
        });
        conditions.add("(action = 'ACCESS_DENIED' and resource_id in (?, ?, ?, ?))");
        args.add("POST /api/v1/process-models");
        args.add("GET /api/v1/workflows/startable");
        args.add("GET /api/v1/started-instances");
        args.add("GET /api/v1/process-instances");
        return jdbcTemplate.update(
                "delete from ko_audit_log where tenant_id = ? and (" + String.join(" or ", conditions) + ")",
                args.toArray()
        );
    }

    private String redact(String detailJson) {
        return detailJson
                .replaceAll("(?i)\"password\"\\s*:\\s*\"[^\"]*\"", "\"password\":\"******\"")
                .replaceAll("(?i)\"token\"\\s*:\\s*\"[^\"]*\"", "\"token\":\"******\"")
                .replaceAll("(?i)\"secret\"\\s*:\\s*\"[^\"]*\"", "\"secret\":\"******\"");
    }

    List<String> hiddenAuditLikePatterns() {
        List<String> patterns = new ArrayList<>();
        RuntimeVisibilityPolicy.HIDDEN_BUSINESS_KEY_PATTERNS.forEach(pattern -> {
            patterns.add(pattern);
            patterns.add("%" + pattern);
        });
        RuntimeVisibilityPolicy.HIDDEN_PROCESS_DEFINITION_PATTERNS.forEach(pattern -> patterns.add("%" + pattern + "%"));
        patterns.add("%\"assetOrigin\":\"LEGACY_DEMO\"%");
        patterns.add("%\"assetOrigin\":\"TEST_FIXTURE\"%");
        patterns.add("%\"assetOrigin\":\"SAMPLE\"%");
        return patterns;
    }
}
