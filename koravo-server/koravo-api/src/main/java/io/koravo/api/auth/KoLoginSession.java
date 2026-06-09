package io.koravo.api.auth;

import io.koravo.common.model.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "ko_login_session")
public class KoLoginSession extends BaseEntity {
    @Column(name = "token_hash", nullable = false, length = 128)
    private String tokenHash;

    @Column(name = "user_id", nullable = false, length = 128)
    private String userId;

    @Column(name = "role", nullable = false, length = 64)
    private String role;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    public String getTokenHash() {
        return tokenHash;
    }

    public void setTokenHash(String tokenHash) {
        this.tokenHash = tokenHash;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }

    public void setLastSeenAt(Instant lastSeenAt) {
        this.lastSeenAt = lastSeenAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public void setRevokedAt(Instant revokedAt) {
        this.revokedAt = revokedAt;
    }
}
