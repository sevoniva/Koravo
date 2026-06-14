package io.koravo.api.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LoginSessionRepository extends JpaRepository<KoLoginSession, String> {
    Optional<KoLoginSession> findByTokenHashAndDeletedFalse(String tokenHash);
}
