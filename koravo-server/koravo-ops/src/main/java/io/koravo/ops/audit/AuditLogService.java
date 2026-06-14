package io.koravo.ops.audit;

import io.koravo.common.util.JsonUtils;
import io.koravo.common.web.RequestContextHolder;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogService {
    private final AuditLogRepository repository;

    public AuditLogService(AuditLogRepository repository) {
        this.repository = repository;
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

    private String redact(String detailJson) {
        return detailJson
                .replaceAll("(?i)\"password\"\\s*:\\s*\"[^\"]*\"", "\"password\":\"******\"")
                .replaceAll("(?i)\"token\"\\s*:\\s*\"[^\"]*\"", "\"token\":\"******\"")
                .replaceAll("(?i)\"secret\"\\s*:\\s*\"[^\"]*\"", "\"secret\":\"******\"");
    }
}
