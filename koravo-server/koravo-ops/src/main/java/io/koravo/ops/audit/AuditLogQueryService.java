package io.koravo.ops.audit;

import io.koravo.common.api.PageResult;
import io.koravo.ops.audit.dto.AuditLogResponse;
import io.koravo.tenant.TenantContextHolder;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class AuditLogQueryService {
    private final AuditLogRepository repository;

    public AuditLogQueryService(AuditLogRepository repository) {
        this.repository = repository;
    }

    public PageResult<AuditLogResponse> query(
            String userId,
            String action,
            String resourceType,
            String resourceId,
            String requestId,
            Instant startTime,
            Instant endTime,
            int page,
            int pageSize
    ) {
        int safePage = Math.max(page, 1);
        int safePageSize = pageSize <= 0 ? 20 : Math.min(pageSize, 200);
        var result = repository.findAll(specification(userId, action, resourceType, resourceId, requestId, startTime, endTime),
                PageRequest.of(safePage - 1, safePageSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(result.getContent().stream().map(this::toResponse).toList(), result.getTotalElements(), safePage, safePageSize);
    }

    public List<AuditLogResponse> queryByResource(String resourceType, String resourceId, int limit) {
        int safeLimit = limit <= 0 ? 20 : Math.min(limit, 100);
        var result = repository.findAll(resourceSpecification(resourceType, resourceId),
                PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "createdAt")));
        return result.getContent().stream().map(this::toResponse).toList();
    }

    private Specification<AuditLog> specification(String userId, String action, String resourceType, String resourceId, String requestId, Instant startTime, Instant endTime) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("tenantId"), TenantContextHolder.getTenantId()));
            if (StringUtils.hasText(userId)) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }
            if (StringUtils.hasText(action)) {
                predicates.add(cb.equal(root.get("action"), action));
            }
            if (StringUtils.hasText(resourceType)) {
                predicates.add(cb.equal(root.get("resourceType"), resourceType));
            }
            if (StringUtils.hasText(resourceId)) {
                predicates.add(cb.equal(root.get("resourceId"), resourceId));
            }
            if (StringUtils.hasText(requestId)) {
                predicates.add(cb.equal(root.get("requestId"), requestId));
            }
            if (startTime != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startTime));
            }
            if (endTime != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endTime));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private Specification<AuditLog> resourceSpecification(String resourceType, String resourceId) {
        return (root, query, cb) -> cb.and(
                cb.equal(root.get("tenantId"), TenantContextHolder.getTenantId()),
                cb.equal(root.get("resourceType"), resourceType),
                cb.equal(root.get("resourceId"), resourceId)
        );
    }

    private AuditLogResponse toResponse(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getTenantId(),
                log.getUserId(),
                log.getAction(),
                log.getResourceType(),
                log.getResourceId(),
                log.getRequestId(),
                log.getClientIp(),
                redact(log.getDetailJson()),
                log.getCreatedAt()
        );
    }

    private String redact(String detailJson) {
        if (detailJson == null) {
            return "{}";
        }
        return detailJson
                .replaceAll("(?i)\"password\"\\s*:\\s*\"[^\"]*\"", "\"password\":\"******\"")
                .replaceAll("(?i)\"token\"\\s*:\\s*\"[^\"]*\"", "\"token\":\"******\"")
                .replaceAll("(?i)\"secret\"\\s*:\\s*\"[^\"]*\"", "\"secret\":\"******\"");
    }
}
