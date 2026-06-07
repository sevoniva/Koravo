package io.koravo.form.repo;

import io.koravo.form.domain.KoFormSchema;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FormSchemaRepository extends JpaRepository<KoFormSchema, String> {
    Optional<KoFormSchema> findByIdAndTenantIdAndDeletedFalse(String id, String tenantId);
}
