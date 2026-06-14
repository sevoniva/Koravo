package io.koravo.datahub.repo;

import io.koravo.datahub.domain.KoDataSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DataSourceRepository extends JpaRepository<KoDataSource, String> {
    List<KoDataSource> findByTenantIdAndDeletedFalseOrderByCreatedAtDesc(String tenantId);

    Optional<KoDataSource> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

    long countByTenantIdAndDeletedFalse(String tenantId);
}
