package io.koravo.security;

import io.koravo.common.util.IdGenerator;
import io.koravo.common.util.JsonUtils;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;

@Component
public class JdbcAccessDeniedAuditRecorder implements AccessDeniedAuditRecorder {
    private static final int RESOURCE_ID_LIMIT = 128;

    private final DataSource dataSource;

    public JdbcAccessDeniedAuditRecorder(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void recordAccessDenied(AccessDeniedAuditEvent event) {
        Instant now = Instant.now();
        try (var connection = dataSource.getConnection();
             PreparedStatement statement = connection.prepareStatement("""
                     insert into ko_audit_log (
                         id, tenant_id, user_id, action, resource_type, resource_id,
                         request_id, client_ip, detail_json,
                         created_by, created_at, updated_by, updated_at, deleted
                     ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     """)) {
            String userId = valueOrDefault(event.userId(), UserContextHolder.ANONYMOUS);
            Timestamp timestamp = Timestamp.from(now);
            statement.setString(1, IdGenerator.nextId());
            statement.setString(2, valueOrDefault(event.tenantId(), "default"));
            statement.setString(3, userId);
            statement.setString(4, "ACCESS_DENIED");
            statement.setString(5, "API_ENDPOINT");
            statement.setString(6, resourceId(event));
            statement.setString(7, event.requestId());
            statement.setString(8, event.clientIp());
            statement.setString(9, detailJson(event));
            statement.setString(10, userId);
            statement.setTimestamp(11, timestamp);
            statement.setString(12, userId);
            statement.setTimestamp(13, timestamp);
            statement.setBoolean(14, false);
            statement.executeUpdate();
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to record access denied audit", ex);
        }
    }

    private String resourceId(AccessDeniedAuditEvent event) {
        String id = event.method() + " " + event.path();
        return id.length() <= RESOURCE_ID_LIMIT ? id : id.substring(0, RESOURCE_ID_LIMIT);
    }

    private String detailJson(AccessDeniedAuditEvent event) {
        return JsonUtils.toJson(Map.of(
                "method", event.method(),
                "path", event.path(),
                "userId", valueOrDefault(event.userId(), UserContextHolder.ANONYMOUS),
                "role", valueOrDefault(event.role(), UserContextHolder.ROLE_ANONYMOUS),
                "reason", "ROLE_PERMISSION_DENIED"
        ));
    }

    private String valueOrDefault(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value;
    }
}
