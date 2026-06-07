package io.koravo.connector.repo;

import io.koravo.connector.domain.KoConnectorExecutionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ConnectorExecutionLogRepository extends JpaRepository<KoConnectorExecutionLog, String>, JpaSpecificationExecutor<KoConnectorExecutionLog> {
}
