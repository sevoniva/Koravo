package io.koravo.model.repo;

import io.koravo.model.domain.KoProcessModel;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcessModelRepository extends JpaRepository<KoProcessModel, String> {
}
