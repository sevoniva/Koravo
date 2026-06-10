package io.koravo.api.web;

import io.koravo.api.service.ProcessInstanceAppService;
import io.koravo.common.web.RequestContextHolder;
import io.koravo.engine.dto.ProcessInstanceDTO;
import io.koravo.engine.dto.ProcessTraceDTO;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
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
    void startDelegatesToApplicationService() {
        ProcessInstanceAppService service = mock(ProcessInstanceAppService.class);
        ProcessInstanceController controller = new ProcessInstanceController(service);
        Map<String, Object> variables = Map.of("managerApprover", "manager", "financeApprover", "finance");
        StartProcessRequest request = new StartProcessRequest("purchaseApproval", "PO-001", variables, null, null);
        ProcessInstanceDTO instance = new ProcessInstanceDTO("pi-1", "pd-1", "PO-001", "RUNNING");
        when(service.start(request)).thenReturn(instance);

        var response = controller.start(request);

        assertThat(response.data()).isEqualTo(instance);
        verify(service).start(request);
    }

    @Test
    void traceDelegatesToApplicationService() {
        ProcessInstanceAppService service = mock(ProcessInstanceAppService.class);
        ProcessInstanceController controller = new ProcessInstanceController(service);
        ProcessTraceDTO trace = new ProcessTraceDTO(
                "pi-1",
                "pd-1",
                "REQ-001",
                "RUNNING",
                "<definitions />",
                Map.of(),
                List.of("approveTask"),
                List.of(),
                List.of()
        );
        when(service.trace("pi-1")).thenReturn(trace);

        var response = controller.trace("pi-1");

        assertThat(response.data()).isEqualTo(trace);
        verify(service).trace("pi-1");
    }
}
