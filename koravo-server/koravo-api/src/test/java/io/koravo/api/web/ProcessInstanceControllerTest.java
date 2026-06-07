package io.koravo.api.web;

import io.koravo.api.service.ProcessInstanceAppService;
import io.koravo.common.web.RequestContextHolder;
import io.koravo.engine.dto.ProcessInstanceDTO;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

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
        Map<String, Object> variables = Map.of("approver", "admin");
        StartProcessRequest request = new StartProcessRequest("leaveApproval", "LEAVE-001", variables);
        ProcessInstanceDTO instance = new ProcessInstanceDTO("pi-1", "pd-1", "LEAVE-001", "RUNNING");
        when(service.start(request)).thenReturn(instance);

        var response = controller.start(request);

        assertThat(response.data()).isEqualTo(instance);
        verify(service).start(request);
    }
}
