package io.koravo.security;

import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JdbcAccessDeniedAuditRecorderTest {
    private final DataSource dataSource = mock(DataSource.class);
    private final Connection connection = mock(Connection.class);
    private final PreparedStatement statement = mock(PreparedStatement.class);
    private final JdbcAccessDeniedAuditRecorder recorder = new JdbcAccessDeniedAuditRecorder(dataSource);

    @Test
    void recordsDeniedRequestToAuditTable() throws Exception {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement(anyString())).thenReturn(statement);

        recorder.recordAccessDenied(new AccessDeniedAuditEvent(
                "POST",
                "/api/v1/process-models",
                "starter",
                "applicant",
                "default",
                "req-1",
                "127.0.0.1"
        ));

        verify(statement).setString(2, "default");
        verify(statement).setString(3, "starter");
        verify(statement).setString(4, "ACCESS_DENIED");
        verify(statement).setString(5, "API_ENDPOINT");
        verify(statement).setString(6, "POST /api/v1/process-models");
        verify(statement).setString(7, "req-1");
        verify(statement).setString(8, "127.0.0.1");
        verify(statement).executeUpdate();
    }
}
