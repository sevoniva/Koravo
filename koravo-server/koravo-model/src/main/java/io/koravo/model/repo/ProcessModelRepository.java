package io.koravo.model.repo;

import io.koravo.model.domain.KoProcessModel;
import io.koravo.model.domain.ProcessModelStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProcessModelRepository extends JpaRepository<KoProcessModel, String> {
    List<KoProcessModel> findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(String tenantId);

    List<KoProcessModel> findByTenantIdAndStatusAndDeletedFalseOrderByUpdatedAtDesc(String tenantId, ProcessModelStatus status);

    Optional<KoProcessModel> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

    Optional<KoProcessModel> findFirstByTenantIdAndFlowableDefinitionIdAndDeletedFalseOrderByUpdatedAtDesc(
            String tenantId,
            String flowableDefinitionId
    );
}
