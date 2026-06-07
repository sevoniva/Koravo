package io.koravo.ops.web;

import io.koravo.common.api.PageResult;
import io.koravo.ops.audit.AuditLogQueryService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuditLogControllerTest {
    private final AuditLogQueryService auditLogQueryService = mock(AuditLogQueryService.class);
    private final AuditLogController controller = new AuditLogController(auditLogQueryService);

    @Test
    void queryPassesTimeRangeToService() {
        Instant startTime = Instant.parse("2026-06-07T00:00:00Z");
        Instant endTime = Instant.parse("2026-06-07T23:59:59Z");
        when(auditLogQueryService.query("admin", "TASK_COMPLETE", "TASK", "task-1", startTime, endTime, 2, 10))
                .thenReturn(PageResult.of(List.of(), 0, 2, 10));

        var response = controller.query("admin", "TASK_COMPLETE", "TASK", "task-1", startTime, endTime, 2, 10);

        assertThat(response.success()).isTrue();
        assertThat(response.data().page()).isEqualTo(2);
        verify(auditLogQueryService).query("admin", "TASK_COMPLETE", "TASK", "task-1", startTime, endTime, 2, 10);
    }
}
