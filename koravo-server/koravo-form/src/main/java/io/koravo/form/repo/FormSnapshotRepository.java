package io.koravo.form.repo;

import io.koravo.form.domain.KoFormSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FormSnapshotRepository extends JpaRepository<KoFormSnapshot, String> {
}
