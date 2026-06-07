package io.koravo.connector.repo;

import io.koravo.connector.domain.KoConnectorExecutionLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConnectorExecutionLogRepository extends JpaRepository<KoConnectorExecutionLog, String> {
}
