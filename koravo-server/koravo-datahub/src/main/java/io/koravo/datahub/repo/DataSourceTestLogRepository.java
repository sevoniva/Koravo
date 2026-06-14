package io.koravo.datahub.repo;

import io.koravo.datahub.domain.KoDataSourceTestLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DataSourceTestLogRepository extends JpaRepository<KoDataSourceTestLog, String> {
    Page<KoDataSourceTestLog> findByTenantIdAndDatasourceIdOrderByCreatedAtDesc(
            String tenantId,
            String datasourceId,
            Pageable pageable
    );
}
