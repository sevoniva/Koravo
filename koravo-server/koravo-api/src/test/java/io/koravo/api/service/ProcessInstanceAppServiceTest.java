package io.koravo.api.service;

import io.koravo.api.web.StartProcessRequest;
import io.koravo.common.web.RequestContextHolder;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.StartProcessCommand;
import io.koravo.engine.dto.ProcessInstanceDTO;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProcessInstanceAppServiceTest {
    private final ProcessFacade processFacade = mock(ProcessFacade.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final ProcessInstanceAppService service = new ProcessInstanceAppService(processFacade, auditLogService);

    @AfterEach
    void tearDown() {
        RequestContextHolder.clear();
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void startPassesRuntimeContextAndWritesInstanceAudit() {
        Map<String, Object> variables = Map.of("approver", "admin");
        StartProcessRequest request = new StartProcessRequest("leaveApproval", "LEAVE-001", variables);
        ProcessInstanceDTO instance = new ProcessInstanceDTO("pi-1", "pd-1", "LEAVE-001", "RUNNING");
        RequestContextHolder.set("req-1", "127.0.0.1");
        TenantContextHolder.setTenantId("tenant-a");
        UserContextHolder.setUserId("starter");
        when(processFacade.start(new StartProcessCommand(
                "tenant-a",
                "starter",
                "req-1",
                "leaveApproval",
                "LEAVE-001",
                variables
        ))).thenReturn(instance);

        ProcessInstanceDTO result = service.start(request);

        assertThat(result).isEqualTo(instance);
        verify(auditLogService).record(eq("PROCESS_INSTANCE_START"), eq("PROCESS_INSTANCE"), eq("pi-1"), eq(Map.of(
                "processDefinitionKey", "leaveApproval",
                "processDefinitionId", "pd-1",
                "status", "RUNNING",
                "businessKey", "LEAVE-001"
        )));
    }
}
