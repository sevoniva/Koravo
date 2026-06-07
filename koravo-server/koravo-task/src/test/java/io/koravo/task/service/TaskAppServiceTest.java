package io.koravo.task.service;

import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.CompleteTaskCommand;
import io.koravo.engine.command.TaskQueryCommand;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.TaskCommentDTO;
import io.koravo.engine.dto.TaskDTO;
import io.koravo.common.api.PageResult;
import io.koravo.form.service.FormBindingService;
import io.koravo.form.service.FormSnapshotService;
import io.koravo.form.service.FormSchemaService;
import io.koravo.form.web.FormSnapshotResponse;
import io.koravo.form.web.FormBindingResponse;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.model.domain.KoProcessModel;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.ops.audit.dto.AuditLogResponse;
import io.koravo.security.UserContextHolder;
import io.koravo.task.web.CompleteTaskRequest;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class TaskAppServiceTest {
    private final ProcessFacade processFacade = mock(ProcessFacade.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final AuditLogQueryService auditLogQueryService = mock(AuditLogQueryService.class);
    private final FormSnapshotService formSnapshotService = mock(FormSnapshotService.class);
    private final FormBindingService formBindingService = mock(FormBindingService.class);
    private final FormSchemaService formSchemaService = mock(FormSchemaService.class);
    private final ProcessModelRepository processModelRepository = mock(ProcessModelRepository.class);
    private final TaskAppService service = new TaskAppService(
            processFacade,
            auditLogService,
            auditLogQueryService,
            formSnapshotService,
            formBindingService,
            formSchemaService,
            processModelRepository
    );

    @Test
    void taskDetailAndCompletionRunInsideTransactions() throws NoSuchMethodException {
        Transactional detailTransaction = TaskAppService.class
                .getMethod("getTaskDetail", String.class)
                .getAnnotation(Transactional.class);
        Transactional completionTransaction = TaskAppService.class
                .getMethod("completeTask", String.class, CompleteTaskRequest.class)
                .getAnnotation(Transactional.class);

        assertThat(detailTransaction).isNotNull();
        assertThat(detailTransaction.readOnly()).isTrue();
        assertThat(completionTransaction).isNotNull();
        assertThat(completionTransaction.readOnly()).isFalse();
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        UserContextHolder.clear();
    }

    @Test
    void queryDoneTasksUsesCurrentTenantAndUser() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(processFacade.queryDoneTasks(new TaskQueryCommand("default", "admin", 1, 20)))
                .thenReturn(PageResult.of(List.of(), 0, 1, 20));

        var result = service.queryDoneTasks(1, 20);

        assertThat(result.items()).isEmpty();
        verify(processFacade).queryDoneTasks(new TaskQueryCommand("default", "admin", 1, 20));
    }

    @Test
    void queryStartedInstancesUsesCurrentTenantAndUser() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(processFacade.queryStartedInstances(new TaskQueryCommand("default", "admin", 1, 20)))
                .thenReturn(PageResult.of(List.of(), 0, 1, 20));

        PageResult<ProcessInstanceDetailDTO> result = service.queryStartedInstances(1, 20);

        assertThat(result.items()).isEmpty();
        verify(processFacade).queryStartedInstances(new TaskQueryCommand("default", "admin", 1, 20));
    }

    @Test
    void completeTaskSavesSubmittedFormSnapshotAndComment() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(processFacade.getTask("default", "admin", "task-1")).thenReturn(new TaskDTO(
                "task-1",
                "Approve",
                "pi-1",
                "pd-1",
                "biz-1",
                null,
                "admin",
                "approveTask",
                "RUNNING"
        ));

        service.completeTask(
                "task-1",
                new CompleteTaskRequest(
                        Map.of("approved", true),
                        Map.of("reason", "ok"),
                        "form-1",
                        "LGTM"
                )
        );

        verify(formSnapshotService).saveSnapshot("pi-1", "task-1", "form-1", Map.of("reason", "ok"));
        verify(processFacade).completeTask(any(CompleteTaskCommand.class));
        verify(auditLogService).record(eq("TASK_COMPLETE"), eq("TASK"), eq("task-1"), eq(Map.of(
                "taskId", "task-1",
                "processInstanceId", "pi-1",
                "businessKey", "biz-1",
                "taskDefinitionKey", "approveTask",
                "formSchemaId", "form-1"
        )));
    }

    @Test
    void completeTaskUsesBoundFormSchemaWhenRequestOmitsFormSchemaId() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(processFacade.getTask("default", "admin", "task-1")).thenReturn(new TaskDTO(
                "task-1",
                "Approve",
                "pi-1",
                "pd-1",
                "biz-1",
                null,
                "admin",
                "approveTask",
                "RUNNING"
        ));
        when(formBindingService.findByProcessDefinitionTaskKey("pd-1", "approveTask")).thenReturn(java.util.Optional.of(
                new FormBindingResponse("binding-1", null, "pd-1", "approveTask", "form-1", 1)
        ));

        service.completeTask(
                "task-1",
                new CompleteTaskRequest(
                        Map.of("approved", true),
                        Map.of("reason", "ok"),
                        null,
                        "LGTM"
                )
        );

        verify(formSnapshotService).saveSnapshot("pi-1", "task-1", "form-1", Map.of("reason", "ok"));
        verify(auditLogService).record(eq("TASK_COMPLETE"), eq("TASK"), eq("task-1"), eq(Map.of(
                "taskId", "task-1",
                "processInstanceId", "pi-1",
                "businessKey", "biz-1",
                "taskDefinitionKey", "approveTask",
                "formSchemaId", "form-1"
        )));
    }

    @Test
    void completeTaskUsesModelScopedBindingWhenDefinitionBindingIsMissing() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(processFacade.getTask("default", "admin", "task-1")).thenReturn(new TaskDTO(
                "task-1",
                "Approve",
                "pi-1",
                "pd-1",
                "biz-1",
                null,
                "admin",
                "approveTask",
                "RUNNING"
        ));
        KoProcessModel model = model("model-1", "pd-1");
        when(formBindingService.findByProcessDefinitionTaskKey("pd-1", "approveTask")).thenReturn(Optional.empty());
        when(processModelRepository.findFirstByTenantIdAndFlowableDefinitionIdAndDeletedFalseOrderByUpdatedAtDesc("default", "pd-1"))
                .thenReturn(Optional.of(model));
        when(formBindingService.findByProcessModelTaskKey("model-1", "approveTask")).thenReturn(Optional.of(
                new FormBindingResponse("binding-1", "model-1", null, "approveTask", "form-1", 1)
        ));

        service.completeTask(
                "task-1",
                new CompleteTaskRequest(
                        Map.of("approved", true),
                        Map.of("reason", "ok"),
                        null,
                        "LGTM"
                )
        );

        verify(formSnapshotService).saveSnapshot("pi-1", "task-1", "form-1", Map.of("reason", "ok"));
        verify(auditLogService).record(eq("TASK_COMPLETE"), eq("TASK"), eq("task-1"), eq(Map.of(
                "taskId", "task-1",
                "processInstanceId", "pi-1",
                "businessKey", "biz-1",
                "taskDefinitionKey", "approveTask",
                "formSchemaId", "form-1"
        )));
    }

    @Test
    void getTaskDetailReturnsBoundFormSchemaVariablesCommentsAndSnapshots() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(processFacade.getTaskForDetail("default", "admin", "task-1")).thenReturn(new TaskDTO(
                "task-1",
                "Approve",
                "pi-1",
                "pd-1",
                "biz-1",
                null,
                "admin",
                "approveTask",
                "RUNNING"
        ));
        when(formBindingService.findByProcessDefinitionTaskKey("pd-1", "approveTask")).thenReturn(java.util.Optional.of(
                new FormBindingResponse("binding-1", null, "pd-1", "approveTask", "form-1", 1)
        ));
        when(formSchemaService.get("form-1")).thenReturn(new FormSchemaResponse(
                "form-1",
                "leave",
                "Leave",
                1,
                "{\"type\":\"object\"}",
                null,
                "ACTIVE"
        ));
        when(processFacade.getProcessVariables("default", "pi-1")).thenReturn(Map.of("days", 2));
        when(processFacade.getTaskVariablesForDetail("default", "admin", "task-1")).thenReturn(Map.of("approved", true));
        when(processFacade.getTaskComments("default", "pi-1", "task-1")).thenReturn(List.of(
                new TaskCommentDTO("comment-1", "admin", "LGTM", Instant.parse("2026-06-07T00:00:00Z"))
        ));
        when(formSnapshotService.listByProcessInstance("pi-1")).thenReturn(List.of(
                new FormSnapshotResponse(
                        "snapshot-1",
                        "pi-1",
                        "task-0",
                        "form-1",
                        "{\"reason\":\"ok\"}",
                        Instant.parse("2026-06-07T00:00:00Z")
                )
        ));
        when(auditLogQueryService.queryByResource("TASK", "task-1", 20)).thenReturn(List.of(
                new AuditLogResponse(
                        "audit-1",
                        "default",
                        "admin",
                        "TASK_COMPLETE",
                        "TASK",
                        "task-1",
                        "req-1",
                        "127.0.0.1",
                        "{\"taskId\":\"task-1\"}",
                        Instant.parse("2026-06-07T00:00:00Z")
                )
        ));

        var detail = service.getTaskDetail("task-1");

        assertThat(detail.task().taskId()).isEqualTo("task-1");
        assertThat(detail.task().status()).isEqualTo("RUNNING");
        assertThat(detail.formBinding().formSchemaId()).isEqualTo("form-1");
        assertThat(detail.formSchema().schemaJson()).contains("object");
        assertThat(detail.processVariables()).containsEntry("days", 2);
        assertThat(detail.taskVariables()).containsEntry("approved", true);
        assertThat(detail.comments()).extracting(TaskCommentDTO::message).containsExactly("LGTM");
        assertThat(detail.formSnapshots()).extracting(FormSnapshotResponse::id).containsExactly("snapshot-1");
        assertThat(detail.auditLogs()).extracting(AuditLogResponse::action).containsExactly("TASK_COMPLETE");
    }

    @Test
    void getTaskDetailUsesModelScopedBindingWhenDefinitionBindingIsMissing() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(processFacade.getTaskForDetail("default", "admin", "task-1")).thenReturn(new TaskDTO(
                "task-1",
                "Approve",
                "pi-1",
                "pd-1",
                "biz-1",
                null,
                "admin",
                "approveTask",
                "RUNNING"
        ));
        when(formBindingService.findByProcessDefinitionTaskKey("pd-1", "approveTask")).thenReturn(Optional.empty());
        when(processModelRepository.findFirstByTenantIdAndFlowableDefinitionIdAndDeletedFalseOrderByUpdatedAtDesc("default", "pd-1"))
                .thenReturn(Optional.of(model("model-1", "pd-1")));
        when(formBindingService.findByProcessModelTaskKey("model-1", "approveTask")).thenReturn(Optional.of(
                new FormBindingResponse("binding-1", "model-1", null, "approveTask", "form-1", 1)
        ));
        when(formSchemaService.get("form-1")).thenReturn(new FormSchemaResponse(
                "form-1",
                "leave",
                "Leave",
                1,
                "{\"type\":\"object\"}",
                null,
                "ACTIVE"
        ));
        when(processFacade.getProcessVariables("default", "pi-1")).thenReturn(Map.of());
        when(processFacade.getTaskVariablesForDetail("default", "admin", "task-1")).thenReturn(Map.of());
        when(processFacade.getTaskComments("default", "pi-1", "task-1")).thenReturn(List.of());
        when(formSnapshotService.listByProcessInstance("pi-1")).thenReturn(List.of());
        when(auditLogQueryService.queryByResource("TASK", "task-1", 20)).thenReturn(List.of());

        var detail = service.getTaskDetail("task-1");

        assertThat(detail.formBinding().processModelId()).isEqualTo("model-1");
        assertThat(detail.formSchema().id()).isEqualTo("form-1");
    }

    @Test
    void getTaskDetailUsesHistoricTaskLookupForCompletedTasks() {
        TenantContextHolder.setTenantId("default");
        UserContextHolder.setUserId("admin");
        when(processFacade.getTaskForDetail("default", "admin", "done-task-1")).thenReturn(new TaskDTO(
                "done-task-1",
                "Approve",
                "pi-1",
                "pd-1",
                "biz-1",
                null,
                "admin",
                "approveTask",
                "COMPLETED"
        ));
        when(processFacade.getProcessVariables("default", "pi-1")).thenReturn(Map.of("approved", true));
        when(processFacade.getTaskVariablesForDetail("default", "admin", "done-task-1")).thenReturn(Map.of("approved", true));
        when(processFacade.getTaskComments("default", "pi-1", "done-task-1")).thenReturn(List.of());
        when(formSnapshotService.listByProcessInstance("pi-1")).thenReturn(List.of());
        when(auditLogQueryService.queryByResource("TASK", "done-task-1", 20)).thenReturn(List.of());

        var detail = service.getTaskDetail("done-task-1");

        assertThat(detail.task().taskId()).isEqualTo("done-task-1");
        assertThat(detail.task().status()).isEqualTo("COMPLETED");
        assertThat(detail.processVariables()).containsEntry("approved", true);
        verify(processFacade).getTaskForDetail("default", "admin", "done-task-1");
        verify(processFacade).getTaskVariablesForDetail("default", "admin", "done-task-1");
    }

    private KoProcessModel model(String id, String processDefinitionId) {
        KoProcessModel model = new KoProcessModel();
        model.setId(id);
        model.setTenantId("default");
        model.setModelKey("leaveApproval");
        model.setModelName("Leave Approval");
        model.setModelType("BPMN");
        model.setVersion(1);
        model.setFlowableDefinitionId(processDefinitionId);
        model.setStatus(ProcessModelStatus.DEPLOYED);
        model.setBpmnXml("<definitions />");
        return model;
    }
}
