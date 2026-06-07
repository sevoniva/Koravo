package io.koravo.ops.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.Instant;

public interface AuditLogRepository extends JpaRepository<AuditLog, String>, JpaSpecificationExecutor<AuditLog> {
    long countByTenantIdAndActionAndCreatedAtGreaterThanEqual(String tenantId, String action, Instant createdAt);
}
