package io.koravo.form.repo;

import io.koravo.form.domain.KoFormBinding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FormBindingRepository extends JpaRepository<KoFormBinding, String> {
    List<KoFormBinding> findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(String tenantId);

    List<KoFormBinding> findByTenantIdAndProcessModelIdAndDeletedFalseOrderByUpdatedAtDesc(
            String tenantId,
            String processModelId
    );

    Optional<KoFormBinding> findFirstByTenantIdAndProcessModelIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
            String tenantId,
            String processModelId,
            String taskDefinitionKey
    );

    Optional<KoFormBinding> findFirstByTenantIdAndProcessDefinitionIdAndTaskDefinitionKeyAndDeletedFalseOrderByUpdatedAtDesc(
            String tenantId,
            String processDefinitionId,
            String taskDefinitionKey
    );
}
