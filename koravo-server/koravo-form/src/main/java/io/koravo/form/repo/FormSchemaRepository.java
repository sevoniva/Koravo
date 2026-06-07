package io.koravo.form.repo;

import io.koravo.form.domain.KoFormSchema;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FormSchemaRepository extends JpaRepository<KoFormSchema, String> {
    List<KoFormSchema> findByTenantIdAndDeletedFalseOrderByUpdatedAtDesc(String tenantId);

    Optional<KoFormSchema> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);

    long countByTenantIdAndDeletedFalse(String tenantId);

    Optional<KoFormSchema> findFirstByTenantIdAndFormKeyAndDeletedFalseOrderByUpdatedAtDesc(
            String tenantId,
            String formKey
    );
}
