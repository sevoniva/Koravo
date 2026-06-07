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
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.ops.audit.dto.AuditLogResponse;
import io.koravo.security.UserContextHolder;
import io.koravo.task.web.CompleteTaskRequest;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
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
    private final TaskAppService service = new TaskAppService(
            processFacade,
            auditLogService,
            auditLogQueryService,
            formSnapshotService,
            formBindingService,
            formSchemaService
    );

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
                "approveTask"
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
    }

    @Test
    void getTaskDetailReturnsBoundFormSchemaVariablesCommentsAndSnapshots() {
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
                "approveTask"
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
        when(processFacade.getTaskVariables("default", "admin", "task-1")).thenReturn(Map.of("approved", true));
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
        assertThat(detail.formBinding().formSchemaId()).isEqualTo("form-1");
        assertThat(detail.formSchema().schemaJson()).contains("object");
        assertThat(detail.processVariables()).containsEntry("days", 2);
        assertThat(detail.taskVariables()).containsEntry("approved", true);
        assertThat(detail.comments()).extracting(TaskCommentDTO::message).containsExactly("LGTM");
        assertThat(detail.formSnapshots()).extracting(FormSnapshotResponse::id).containsExactly("snapshot-1");
        assertThat(detail.auditLogs()).extracting(AuditLogResponse::action).containsExactly("TASK_COMPLETE");
    }
}
