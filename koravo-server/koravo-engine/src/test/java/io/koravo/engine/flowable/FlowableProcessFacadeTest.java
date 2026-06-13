package io.koravo.engine.flowable;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.engine.command.InstanceQueryCommand;
import io.koravo.engine.command.TaskQueryCommand;
import org.flowable.engine.HistoryService;
import org.flowable.engine.IdentityService;
import org.flowable.engine.ManagementService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.engine.history.HistoricProcessInstanceQuery;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.engine.runtime.ProcessInstanceQuery;
import org.flowable.task.api.Task;
import org.flowable.task.api.TaskQuery;
import org.flowable.task.api.history.HistoricTaskInstance;
import org.flowable.task.api.history.HistoricTaskInstanceQuery;
import org.flowable.job.api.DeadLetterJobQuery;
import org.flowable.job.api.Job;
import org.flowable.job.api.JobQuery;
import org.junit.jupiter.api.Test;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlowableProcessFacadeTest {
    private final RepositoryService repositoryService = mock(RepositoryService.class);
    private final RuntimeService runtimeService = mock(RuntimeService.class);
    private final TaskService taskService = mock(TaskService.class);
    private final HistoryService historyService = mock(HistoryService.class);
    private final IdentityService identityService = mock(IdentityService.class);
    private final ManagementService managementService = mock(ManagementService.class);
    private final FlowableProcessFacade facade = new FlowableProcessFacade(
            repositoryService,
            runtimeService,
            taskService,
            historyService,
            identityService,
            managementService
    );

    @Test
    @SuppressWarnings("unchecked")
    void startAddsRequestContextVariables() {
        ProcessInstance instance = mock(ProcessInstance.class);
        when(instance.getId()).thenReturn("pi-1");
        when(instance.getProcessDefinitionId()).thenReturn("pd-1");
        when(instance.getBusinessKey()).thenReturn("biz-1");
        when(runtimeService.startProcessInstanceByKeyAndTenantId(eq("leaveApproval"), eq("biz-1"), anyMap(), eq("default")))
                .thenReturn(instance);

        facade.start(new io.koravo.engine.command.StartProcessCommand(
                "default",
                "admin",
                "req-1",
                "leaveApproval",
                "biz-1",
                Map.of("approver", "admin")
        ));

        var variablesCaptor = forClass(Map.class);
        verify(runtimeService).startProcessInstanceByKeyAndTenantId(eq("leaveApproval"), eq("biz-1"), variablesCaptor.capture(), eq("default"));
        assertThat(variablesCaptor.getValue())
                .containsEntry("tenantId", "default")
                .containsEntry("startUserId", "admin")
                .containsEntry("businessKey", "biz-1")
                .containsEntry("requestId", "req-1")
                .containsEntry("approver", "admin");
    }

    @Test
    @SuppressWarnings("unchecked")
    void startDefaultsApproverToCurrentUserWhenMissing() {
        ProcessInstance instance = mock(ProcessInstance.class);
        when(instance.getId()).thenReturn("pi-1");
        when(instance.getProcessDefinitionId()).thenReturn("pd-1");
        when(instance.getBusinessKey()).thenReturn("biz-1");
        when(runtimeService.startProcessInstanceByKeyAndTenantId(eq("leaveApproval"), eq("biz-1"), anyMap(), eq("default")))
                .thenReturn(instance);

        facade.start(new io.koravo.engine.command.StartProcessCommand(
                "default",
                "starter",
                "req-1",
                "leaveApproval",
                "biz-1",
                Map.of()
        ));

        var variablesCaptor = forClass(Map.class);
        verify(runtimeService).startProcessInstanceByKeyAndTenantId(eq("leaveApproval"), eq("biz-1"), variablesCaptor.capture(), eq("default"));
        assertThat(variablesCaptor.getValue()).containsEntry("approver", "starter");
    }

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
    void queryCandidateTasksMergesCandidateUserAndGroupTasks() {
        TaskQuery userQuery = mock(TaskQuery.class, RETURNS_SELF);
        TaskQuery groupQuery = mock(TaskQuery.class, RETURNS_SELF);
        Task availableTask = mockTask("task-1", "待认领", "pi-1", "pd-1", null, "reviewTask");
        Task assignedTask = mockTask("task-2", "已分配", "pi-1", "pd-1", "manager", "reviewTask");
        HistoricProcessInstanceQuery instanceQuery = mock(HistoricProcessInstanceQuery.class, RETURNS_SELF);
        HistoricProcessInstance instance = mockHistoricInstance("pi-1", "pd-1", "REQ-1", "applicant", null);

        when(taskService.createTaskQuery()).thenReturn(userQuery, groupQuery);
        when(userQuery.list()).thenReturn(List.of(availableTask, assignedTask));
        when(groupQuery.list()).thenReturn(List.of(availableTask));
        when(historyService.createHistoricProcessInstanceQuery()).thenReturn(instanceQuery);
        when(instanceQuery.singleResult()).thenReturn(instance);

        var result = facade.queryCandidateTasks(new io.koravo.engine.command.TaskQueryCommand(
                "default",
                "manager",
                "manager",
                1,
                20,
                null,
                null,
                null,
                null
        ));

        assertThat(result.items()).extracting("taskId").containsExactly("task-1");
        verify(userQuery).taskCandidateUser("manager");
        verify(groupQuery).taskCandidateGroup("manager");
    }

    @Test
    void queryMyTasksExcludesBusinessKeyPatternsBeforePaging() {
        TaskQuery taskQuery = mock(TaskQuery.class, RETURNS_SELF);
        HistoricProcessInstanceQuery instanceQuery = mock(HistoricProcessInstanceQuery.class, RETURNS_SELF);
        Task acceptanceTask = mockTask("task-1", "多人会签", "pi-1", "collaborativeApproval:2", "manager", "jointApprovalTask");
        Task traceTask = mockTask("task-2", "多人会签", "pi-2", "collaborativeApproval:2", "manager", "jointApprovalTask");
        Task userTask = mockTask("task-3", "审批", "pi-3", "collaborativeApproval:2", "manager", "approvalTask");
        HistoricProcessInstance acceptance = mockHistoricInstance("pi-1", "collaborativeApproval:2", "REQ-CODEX-1", "applicant", null);
        HistoricProcessInstance trace = mockHistoricInstance("pi-2", "collaborativeApproval:2", "TRACE-1", "applicant", null);
        HistoricProcessInstance userFlow = mockHistoricInstance("pi-3", "collaborativeApproval:2", "COLLABORATIVE-APPROVAL-1", "applicant", null);
        when(taskService.createTaskQuery()).thenReturn(taskQuery);
        when(taskQuery.list()).thenReturn(List.of(acceptanceTask, traceTask, userTask));
        when(historyService.createHistoricProcessInstanceQuery()).thenReturn(instanceQuery);
        when(instanceQuery.singleResult()).thenReturn(acceptance, trace, userFlow);

        var result = facade.queryMyTasks(new TaskQueryCommand(
                "default",
                "manager",
                null,
                1,
                10,
                null,
                null,
                null,
                null,
                Set.of("collaborativeApproval"),
                Set.of("REQ-CODEX-%", "TRACE-%")
        ));

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items()).extracting("taskId").containsExactly("task-3");
        verify(taskQuery).taskTenantId("default");
        verify(taskQuery).taskAssignee("manager");
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

    @Test
    void getTaskForDetailAllowsAssigneeHistoricReadback() {
        TaskQuery runtimeQuery = mock(TaskQuery.class, RETURNS_SELF);
        HistoricTaskInstanceQuery historicQuery = mock(HistoricTaskInstanceQuery.class, RETURNS_SELF);
        HistoricProcessInstanceQuery instanceQuery = mock(HistoricProcessInstanceQuery.class, RETURNS_SELF);
        HistoricTaskInstance historicTask = mock(HistoricTaskInstance.class);
        HistoricProcessInstance instance = mock(HistoricProcessInstance.class);
        when(taskService.createTaskQuery()).thenReturn(runtimeQuery);
        when(runtimeQuery.singleResult()).thenReturn(null);
        when(historyService.createHistoricTaskInstanceQuery()).thenReturn(historicQuery);
        when(historicQuery.singleResult()).thenReturn(historicTask);
        when(historyService.createHistoricProcessInstanceQuery()).thenReturn(instanceQuery);
        when(instanceQuery.singleResult()).thenReturn(instance);
        when(instance.getBusinessKey()).thenReturn("PO-1");
        when(historicTask.getId()).thenReturn("done-task-1");
        when(historicTask.getName()).thenReturn("财务审批");
        when(historicTask.getProcessInstanceId()).thenReturn("pi-1");
        when(historicTask.getProcessDefinitionId()).thenReturn("purchaseApproval:1");
        when(historicTask.getAssignee()).thenReturn("finance");
        when(historicTask.getTaskDefinitionKey()).thenReturn("financeApprovalTask");
        when(historicTask.getEndTime()).thenReturn(new java.util.Date());

        var task = facade.getTaskForDetail("default", "finance", "done-task-1");

        assertThat(task.taskId()).isEqualTo("done-task-1");
        assertThat(task.assignee()).isEqualTo("finance");
        assertThat(task.status()).isEqualTo("COMPLETED");
        verify(runtimeQuery).taskTenantId("default");
        verify(runtimeQuery).taskId("done-task-1");
        verify(runtimeQuery, never()).taskAssignee("finance");
        verify(historicQuery).taskTenantId("default");
        verify(historicQuery).taskId("done-task-1");
        verify(historicQuery, never()).taskAssignee("finance");
    }

    @Test
    void getTaskForDetailAllowsStarterToReadProcessTaskContext() {
        TaskQuery runtimeQuery = mock(TaskQuery.class, RETURNS_SELF);
        HistoricProcessInstanceQuery instanceQuery = mock(HistoricProcessInstanceQuery.class, RETURNS_SELF);
        Task runtimeTask = mock(Task.class);
        HistoricProcessInstance instance = mock(HistoricProcessInstance.class);
        when(taskService.createTaskQuery()).thenReturn(runtimeQuery);
        when(runtimeQuery.singleResult()).thenReturn(runtimeTask);
        when(runtimeTask.getId()).thenReturn("task-1");
        when(runtimeTask.getName()).thenReturn("多人会签");
        when(runtimeTask.getProcessInstanceId()).thenReturn("pi-1");
        when(runtimeTask.getProcessDefinitionId()).thenReturn("collaborativeApproval:1");
        when(runtimeTask.getAssignee()).thenReturn("manager");
        when(runtimeTask.getTaskDefinitionKey()).thenReturn("jointApprovalTask");
        when(runtimeTask.getCreateTime()).thenReturn(new java.util.Date());
        when(historyService.createHistoricProcessInstanceQuery()).thenReturn(instanceQuery);
        when(instanceQuery.singleResult()).thenReturn(instance);
        when(instance.getStartUserId()).thenReturn("applicant");
        when(instance.getBusinessKey()).thenReturn("REQ-1");

        var task = facade.getTaskForDetail("default", "applicant", "task-1");

        assertThat(task.taskId()).isEqualTo("task-1");
        assertThat(task.assignee()).isEqualTo("manager");
    }

    @Test
    void getTaskForDetailRejectsUnrelatedWorkflowUser() {
        TaskQuery runtimeQuery = mock(TaskQuery.class, RETURNS_SELF);
        HistoricProcessInstanceQuery instanceQuery = mock(HistoricProcessInstanceQuery.class, RETURNS_SELF);
        Task runtimeTask = mock(Task.class);
        HistoricProcessInstance instance = mock(HistoricProcessInstance.class);
        when(taskService.createTaskQuery()).thenReturn(runtimeQuery);
        when(runtimeQuery.singleResult()).thenReturn(runtimeTask);
        when(runtimeTask.getAssignee()).thenReturn("manager");
        when(runtimeTask.getProcessInstanceId()).thenReturn("pi-1");
        when(historyService.createHistoricProcessInstanceQuery()).thenReturn(instanceQuery);
        when(instanceQuery.singleResult()).thenReturn(instance);
        when(instance.getStartUserId()).thenReturn("applicant");

        assertThatThrownBy(() -> facade.getTaskForDetail("default", "finance", "task-1"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.errorCode()).isEqualTo(ErrorCode.TASK_NOT_FOUND));

        verify(instanceQuery).processInstanceId("pi-1");
        verify(instanceQuery).processInstanceTenantId("default");
    }

    @Test
    void listInstancesFiltersByKeywordAndStatusBeforePaging() {
        HistoricProcessInstanceQuery instanceQuery = mock(HistoricProcessInstanceQuery.class, RETURNS_SELF);
        ProcessInstanceQuery runtimeQuery = mock(ProcessInstanceQuery.class, RETURNS_SELF);
        ProcessInstance runtimeInstance = mock(ProcessInstance.class);
        TaskQuery taskQuery = mock(TaskQuery.class, RETURNS_SELF);
        HistoricProcessInstance purchase = mockHistoricInstance("pi-1", "purchaseApproval:1", "PO-1001", "applicant", null);
        HistoricProcessInstance leave = mockHistoricInstance("pi-2", "leaveApproval:1", "LEAVE-1001", "hr", new Date());
        when(historyService.createHistoricProcessInstanceQuery()).thenReturn(instanceQuery);
        when(instanceQuery.list()).thenReturn(List.of(purchase, leave));
        when(runtimeService.createProcessInstanceQuery()).thenReturn(runtimeQuery);
        when(runtimeQuery.singleResult()).thenReturn(runtimeInstance);
        when(runtimeInstance.isSuspended()).thenReturn(false);
        when(taskService.createTaskQuery()).thenReturn(taskQuery);
        when(taskQuery.list()).thenReturn(List.of());

        var result = facade.listInstances(new InstanceQueryCommand("default", 1, 10, "PO-1001", "RUNNING"));

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items()).extracting("instanceId").containsExactly("pi-1");
        verify(instanceQuery).processInstanceTenantId("default");
    }

    @Test
    void listInstancesExcludesRetiredProcessDefinitionsBeforePaging() {
        HistoricProcessInstanceQuery instanceQuery = mock(HistoricProcessInstanceQuery.class, RETURNS_SELF);
        ProcessInstanceQuery runtimeQuery = mock(ProcessInstanceQuery.class, RETURNS_SELF);
        ProcessInstance runtimeInstance = mock(ProcessInstance.class);
        TaskQuery taskQuery = mock(TaskQuery.class, RETURNS_SELF);
        HistoricProcessInstance purchase = mockHistoricInstance("pi-1", "purchaseApproval:1", "PO-1001", "applicant", null);
        HistoricProcessInstance fixture = mockHistoricInstance("pi-0", "koravoProcessmq5amzdq:1", "PO-1001", "admin", null);
        HistoricProcessInstance collaborative = mockHistoricInstance("pi-2", "collaborativeApproval:2", "REQ-1001", "applicant", null);
        when(historyService.createHistoricProcessInstanceQuery()).thenReturn(instanceQuery);
        when(instanceQuery.list()).thenReturn(List.of(fixture, purchase, collaborative));
        when(runtimeService.createProcessInstanceQuery()).thenReturn(runtimeQuery);
        when(runtimeQuery.singleResult()).thenReturn(runtimeInstance);
        when(runtimeInstance.isSuspended()).thenReturn(false);
        when(taskService.createTaskQuery()).thenReturn(taskQuery);
        when(taskQuery.list()).thenReturn(List.of());

        var result = facade.listInstances(new InstanceQueryCommand("default", 1, 10, null, null, java.util.Set.of(
                "purchaseApproval",
                "koravoProcess%"
        )));

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items()).extracting("instanceId").containsExactly("pi-2");
    }

    @Test
    void listInstancesExcludesBusinessKeyPatternsBeforePaging() {
        HistoricProcessInstanceQuery instanceQuery = mock(HistoricProcessInstanceQuery.class, RETURNS_SELF);
        ProcessInstanceQuery runtimeQuery = mock(ProcessInstanceQuery.class, RETURNS_SELF);
        ProcessInstance runtimeInstance = mock(ProcessInstance.class);
        TaskQuery taskQuery = mock(TaskQuery.class, RETURNS_SELF);
        HistoricProcessInstance enterpriseCheck = mockHistoricInstance("pi-1", "collaborativeApproval:2", "EA-RUNTIME-1", "applicant", null);
        HistoricProcessInstance traceCheck = mockHistoricInstance("pi-2", "collaborativeApproval:2", "TRACE-1", "applicant", null);
        HistoricProcessInstance userFlow = mockHistoricInstance("pi-3", "collaborativeApproval:2", "COLLABORATIVE-APPROVAL-1", "applicant", null);
        when(historyService.createHistoricProcessInstanceQuery()).thenReturn(instanceQuery);
        when(instanceQuery.list()).thenReturn(List.of(enterpriseCheck, traceCheck, userFlow));
        when(runtimeService.createProcessInstanceQuery()).thenReturn(runtimeQuery);
        when(runtimeQuery.singleResult()).thenReturn(runtimeInstance);
        when(runtimeInstance.isSuspended()).thenReturn(false);
        when(taskService.createTaskQuery()).thenReturn(taskQuery);
        when(taskQuery.list()).thenReturn(List.of());

        var result = facade.listInstances(new InstanceQueryCommand(
                "default",
                1,
                10,
                null,
                null,
                java.util.Set.of(),
                java.util.Set.of(
                        "EA-%",
                        "TRACE-%"
                )
        ));

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items()).extracting("instanceId").containsExactly("pi-3");
    }

    @Test
    void getFailedJobReturnsStacktrace() {
        JobQuery query = mock(JobQuery.class, RETURNS_SELF);
        Job job = mockJob("job-1", "FAILED");
        when(managementService.createJobQuery()).thenReturn(query);
        when(query.singleResult()).thenReturn(job);
        when(managementService.getJobExceptionStacktrace("job-1")).thenReturn("stack");

        var result = facade.getFailedJob("default", "job-1");

        assertThat(result.id()).isEqualTo("job-1");
        assertThat(result.type()).isEqualTo("FAILED");
        assertThat(result.exceptionStacktrace()).isEqualTo("stack");
        verify(query).jobTenantId("default");
        verify(query).jobId("job-1");
        verify(query).withException();
    }

    @Test
    void retryDeadLetterJobMovesJobToExecutable() {
        DeadLetterJobQuery query = mock(DeadLetterJobQuery.class, RETURNS_SELF);
        Job job = mockJob("job-1", "DEAD_LETTER");
        when(managementService.createDeadLetterJobQuery()).thenReturn(query);
        when(query.singleResult()).thenReturn(job);

        facade.retryDeadLetterJob("default", "job-1", 4);

        verify(managementService).moveDeadLetterJobToExecutableJob("job-1", 4);
    }

    @Test
    void deleteFailedJobDeletesExecutableJob() {
        JobQuery query = mock(JobQuery.class, RETURNS_SELF);
        Job job = mockJob("job-1", "FAILED");
        when(managementService.createJobQuery()).thenReturn(query);
        when(query.singleResult()).thenReturn(job);

        facade.deleteFailedJob("default", "job-1");

        verify(managementService).deleteJob("job-1");
    }

    private void mockRunningInstance(String tenantId, String instanceId) {
        ProcessInstanceQuery query = mock(ProcessInstanceQuery.class, RETURNS_SELF);
        ProcessInstance instance = mock(ProcessInstance.class);
        when(runtimeService.createProcessInstanceQuery()).thenReturn(query);
        when(query.singleResult()).thenReturn(instance);
        when(instance.getId()).thenReturn(instanceId);
        when(instance.getTenantId()).thenReturn(tenantId);
    }

    private HistoricProcessInstance mockHistoricInstance(
            String id,
            String processDefinitionId,
            String businessKey,
            String startUserId,
            Date endTime
    ) {
        HistoricProcessInstance instance = mock(HistoricProcessInstance.class);
        when(instance.getId()).thenReturn(id);
        when(instance.getTenantId()).thenReturn("default");
        when(instance.getProcessDefinitionId()).thenReturn(processDefinitionId);
        when(instance.getBusinessKey()).thenReturn(businessKey);
        when(instance.getStartUserId()).thenReturn(startUserId);
        when(instance.getStartTime()).thenReturn(new Date(1_700_000_000_000L));
        when(instance.getEndTime()).thenReturn(endTime);
        return instance;
    }

    private Task mockTask(
            String id,
            String name,
            String processInstanceId,
            String processDefinitionId,
            String assignee,
            String taskDefinitionKey
    ) {
        Task task = mock(Task.class);
        when(task.getId()).thenReturn(id);
        when(task.getName()).thenReturn(name);
        when(task.getProcessInstanceId()).thenReturn(processInstanceId);
        when(task.getProcessDefinitionId()).thenReturn(processDefinitionId);
        when(task.getAssignee()).thenReturn(assignee);
        when(task.getTaskDefinitionKey()).thenReturn(taskDefinitionKey);
        when(task.getCreateTime()).thenReturn(new Date(1_700_000_000_000L));
        return task;
    }

    private Job mockJob(String id, String type) {
        Job job = mock(Job.class);
        when(job.getId()).thenReturn(id);
        when(job.getTenantId()).thenReturn("default");
        when(job.getProcessInstanceId()).thenReturn("pi-1");
        when(job.getProcessDefinitionId()).thenReturn("pd-1");
        when(job.getExecutionId()).thenReturn("exec-1");
        when(job.getElementId()).thenReturn("serviceTask");
        when(job.getElementName()).thenReturn("调用接口");
        when(job.getJobHandlerType()).thenReturn("async-continuation");
        when(job.getJobHandlerConfiguration()).thenReturn("cfg");
        when(job.getRetries()).thenReturn(0);
        when(job.getExceptionMessage()).thenReturn(type + " error");
        return job;
    }
}
