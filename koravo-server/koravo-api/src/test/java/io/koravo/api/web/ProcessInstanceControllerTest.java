package io.koravo.api.web;

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

class ProcessInstanceControllerTest {
    @AfterEach
    void tearDown() {
        RequestContextHolder.clear();
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void startPassesRuntimeContextAndWritesInstanceAudit() {
        ProcessFacade processFacade = mock(ProcessFacade.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        ProcessInstanceController controller = new ProcessInstanceController(processFacade, auditLogService);
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

        var response = controller.start(request);

        assertThat(response.data()).isEqualTo(instance);
        verify(auditLogService).record(eq("PROCESS_INSTANCE_START"), eq("PROCESS_INSTANCE"), eq("pi-1"), eq(Map.of(
                "processDefinitionKey", "leaveApproval",
                "businessKey", "LEAVE-001"
        )));
    }
}
