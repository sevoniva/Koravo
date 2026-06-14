package io.koravo.form.repo;

import io.koravo.form.domain.KoFormSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FormSnapshotRepository extends JpaRepository<KoFormSnapshot, String> {
    List<KoFormSnapshot> findByTenantIdAndProcessInstanceIdOrderByCreatedAtAsc(String tenantId, String processInstanceId);
}
