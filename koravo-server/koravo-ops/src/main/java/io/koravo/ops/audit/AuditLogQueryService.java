package io.koravo.ops.audit;

import io.koravo.common.api.PageResult;
import io.koravo.common.workflow.RuntimeVisibilityPolicy;
import io.koravo.ops.audit.dto.AuditLogResponse;
import io.koravo.tenant.TenantContextHolder;
import jakarta.persistence.criteria.Predicate;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbcTemplate;

    public AuditLogQueryService(AuditLogRepository repository, JdbcTemplate jdbcTemplate) {
        this.repository = repository;
        this.jdbcTemplate = jdbcTemplate;
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
        return query(userId, action, resourceType, resourceId, requestId, startTime, endTime, page, pageSize, false);
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
            int pageSize,
            boolean includeNonProduction
    ) {
        int safePage = Math.max(page, 1);
        int safePageSize = pageSize <= 0 ? 20 : Math.min(pageSize, 200);
        var result = repository.findAll(specification(userId, action, resourceType, resourceId, requestId, startTime, endTime, includeNonProduction),
                PageRequest.of(safePage - 1, safePageSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResult.of(result.getContent().stream().map(this::toResponse).toList(), result.getTotalElements(), safePage, safePageSize);
    }

    public List<AuditLogResponse> queryByResource(String resourceType, String resourceId, int limit) {
        int safeLimit = limit <= 0 ? 20 : Math.min(limit, 100);
        var result = repository.findAll(resourceSpecification(resourceType, resourceId),
                PageRequest.of(0, safeLimit, Sort.by(Sort.Direction.DESC, "createdAt")));
        return result.getContent().stream().map(this::toResponse).toList();
    }

    private Specification<AuditLog> specification(String userId, String action, String resourceType, String resourceId, String requestId, Instant startTime, Instant endTime, boolean includeNonProduction) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("tenantId"), TenantContextHolder.getTenantId()));
            if (!includeNonProduction) {
                hiddenAuditLikePatterns().forEach(pattern -> {
                    predicates.add(notLikeOrNull(cb, root.get("resourceId"), pattern));
                    predicates.add(notLikeOrNull(cb, root.get("requestId"), pattern));
                    predicates.add(notLikeOrNull(cb, root.get("detailJson"), pattern));
                });
            }
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
                List<Predicate> resourcePredicates = new ArrayList<>();
                resourcePredicates.add(cb.equal(root.get("resourceId"), resourceId));
                resourcePredicates.add(cb.like(root.get("detailJson"), relatedResourcePattern(resourceId), '\\'));
                relatedTaskIds(resourceId).forEach(taskId -> resourcePredicates.add(cb.equal(root.get("resourceId"), taskId)));
                predicates.add(cb.or(resourcePredicates.toArray(Predicate[]::new)));
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

    Predicate notLikeOrNull(jakarta.persistence.criteria.CriteriaBuilder cb, jakarta.persistence.criteria.Expression<String> expression, String pattern) {
        return cb.or(cb.isNull(expression), cb.notLike(expression, pattern, '\\'));
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

    private Specification<AuditLog> resourceSpecification(String resourceType, String resourceId) {
        return (root, query, cb) -> cb.and(
                cb.equal(root.get("tenantId"), TenantContextHolder.getTenantId()),
                cb.equal(root.get("resourceType"), resourceType),
                cb.equal(root.get("resourceId"), resourceId)
        );
    }

    String relatedResourcePattern(String resourceId) {
        return "%" + resourceId.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    List<String> relatedTaskIds(String processInstanceId) {
        return jdbcTemplate.queryForList(
                        """
                                select distinct task_id
                                from ko_form_snapshot
                                where tenant_id = ? and process_instance_id = ? and task_id is not null
                                """,
                        String.class,
                        TenantContextHolder.getTenantId(),
                        processInstanceId
                ).stream()
                .filter(StringUtils::hasText)
                .toList();
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
