package io.koravo.form.repo;

import io.koravo.form.domain.KoFormSchemaVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FormSchemaVersionRepository extends JpaRepository<KoFormSchemaVersion, String> {
    List<KoFormSchemaVersion> findByTenantIdAndFormSchemaIdAndDeletedFalseOrderByVersionDesc(
            String tenantId,
            String formSchemaId
    );

    Optional<KoFormSchemaVersion> findByTenantIdAndFormSchemaIdAndVersionAndDeletedFalse(
            String tenantId,
            String formSchemaId,
            int version
    );

    boolean existsByTenantIdAndFormSchemaIdAndVersionAndDeletedFalse(
            String tenantId,
            String formSchemaId,
            int version
    );
}
