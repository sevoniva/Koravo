package io.koravo.ops.service;

import io.koravo.engine.api.ProcessFacade;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ProcessOpsServiceTest {
    private final ProcessFacade processFacade = mock(ProcessFacade.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final ProcessOpsService service = new ProcessOpsService(processFacade, auditLogService);

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void terminateInstanceCallsFacadeAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");

        service.terminateInstance("pi-1", "bad data");

        verify(processFacade).terminateProcessInstance("default", "pi-1", "bad data");
        verify(auditLogService).record(eq("PROCESS_INSTANCE_TERMINATE"), eq("PROCESS_INSTANCE"), eq("pi-1"), eq(java.util.Map.of(
                "reason", "bad data"
        )));
    }

    @Test
    void suspendInstanceCallsFacadeAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");

        service.suspendInstance("pi-1");

        verify(processFacade).suspendProcessInstance("default", "pi-1");
        verify(auditLogService).record(eq("PROCESS_INSTANCE_SUSPEND"), eq("PROCESS_INSTANCE"), eq("pi-1"), eq(java.util.Map.of()));
    }

    @Test
    void activateInstanceCallsFacadeAndWritesAuditLog() {
        TenantContextHolder.setTenantId("default");

        service.activateInstance("pi-1");

        verify(processFacade).activateProcessInstance("default", "pi-1");
        verify(auditLogService).record(eq("PROCESS_INSTANCE_ACTIVATE"), eq("PROCESS_INSTANCE"), eq("pi-1"), eq(java.util.Map.of()));
    }
}
