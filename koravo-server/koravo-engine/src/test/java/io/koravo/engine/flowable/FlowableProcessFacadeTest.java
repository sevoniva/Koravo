package io.koravo.engine.flowable;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import org.flowable.engine.HistoryService;
import org.flowable.engine.IdentityService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.engine.runtime.ProcessInstanceQuery;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlowableProcessFacadeTest {
    private final RepositoryService repositoryService = mock(RepositoryService.class);
    private final RuntimeService runtimeService = mock(RuntimeService.class);
    private final TaskService taskService = mock(TaskService.class);
    private final HistoryService historyService = mock(HistoryService.class);
    private final IdentityService identityService = mock(IdentityService.class);
    private final FlowableProcessFacade facade = new FlowableProcessFacade(
            repositoryService,
            runtimeService,
            taskService,
            historyService,
            identityService
    );

    @Test
    void terminateProcessInstanceDeletesRunningTenantInstanceWithReason() {
        mockRunningInstance("default", "pi-1");

        facade.terminateProcessInstance("default", "pi-1", "ops cleanup");

        verify(runtimeService).deleteProcessInstance("pi-1", "ops cleanup");
    }

    @Test
    void suspendProcessInstanceSuspendsRunningTenantInstance() {
        mockRunningInstance("default", "pi-1");

        facade.suspendProcessInstance("default", "pi-1");

        verify(runtimeService).suspendProcessInstanceById("pi-1");
    }

    @Test
    void activateProcessInstanceActivatesRunningTenantInstance() {
        mockRunningInstance("default", "pi-1");

        facade.activateProcessInstance("default", "pi-1");

        verify(runtimeService).activateProcessInstanceById("pi-1");
    }

    @Test
    void terminateProcessInstanceRejectsMissingTenantInstance() {
        ProcessInstanceQuery query = mock(ProcessInstanceQuery.class, RETURNS_SELF);
        when(runtimeService.createProcessInstanceQuery()).thenReturn(query);
        when(query.singleResult()).thenReturn(null);

        assertThatThrownBy(() -> facade.terminateProcessInstance("default", "pi-missing", "ops cleanup"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.errorCode()).isEqualTo(ErrorCode.PROCESS_INSTANCE_NOT_FOUND));
    }

    private void mockRunningInstance(String tenantId, String instanceId) {
        ProcessInstanceQuery query = mock(ProcessInstanceQuery.class, RETURNS_SELF);
        ProcessInstance instance = mock(ProcessInstance.class);
        when(runtimeService.createProcessInstanceQuery()).thenReturn(query);
        when(query.singleResult()).thenReturn(instance);
        when(instance.getId()).thenReturn(instanceId);
        when(instance.getTenantId()).thenReturn(tenantId);
    }
}
