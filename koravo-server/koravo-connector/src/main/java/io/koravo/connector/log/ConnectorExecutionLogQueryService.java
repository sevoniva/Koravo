package io.koravo.connector.log;

import io.koravo.common.api.PageResult;
import io.koravo.connector.domain.KoConnectorExecutionLog;
import io.koravo.connector.repo.ConnectorExecutionLogRepository;
import io.koravo.tenant.TenantContextHolder;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
public class ConnectorExecutionLogQueryService {
    private final ConnectorExecutionLogRepository repository;

    public ConnectorExecutionLogQueryService(ConnectorExecutionLogRepository repository) {
        this.repository = repository;
    }

    public PageResult<ConnectorExecutionLogResponse> query(String connectorType, String status, int page, int pageSize) {
        int safePage = Math.max(page, 1);
        int safePageSize = pageSize <= 0 ? 20 : Math.min(pageSize, 200);
        var result = repository.findAll(
                specification(connectorType, status),
                PageRequest.of(safePage - 1, safePageSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        );
        return PageResult.of(
                result.getContent().stream().map(this::toResponse).toList(),
                result.getTotalElements(),
                safePage,
                safePageSize
        );
    }

    private Specification<KoConnectorExecutionLog> specification(String connectorType, String status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("tenantId"), TenantContextHolder.getTenantId()));
            if (StringUtils.hasText(connectorType)) {
                predicates.add(cb.equal(root.get("connectorType"), connectorType));
            }
            if (StringUtils.hasText(status)) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private ConnectorExecutionLogResponse toResponse(KoConnectorExecutionLog log) {
        return new ConnectorExecutionLogResponse(
                log.getId(),
                log.getConnectorType(),
                log.getMethod(),
                redact(log.getUrl()),
                log.getStatus(),
                log.getStatusCode(),
                log.getElapsedMillis(),
                log.getRequestId(),
                redact(log.getRequestSummary()),
                redact(log.getResponseSummary()),
                redact(log.getErrorMessage()),
                log.getCreatedAt()
        );
    }

    private String redact(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        return value
                .replaceAll("(?i)(password|token|secret)(=|\\\":\\\"|:)[^\\s,}&]+", "$1$2***")
                .replaceAll("(?i)(Authorization=)[^,}]+", "$1***")
                .replaceAll("(?i)(Bearer\\s+)[^\\s,}]+", "$1***");
    }
}
