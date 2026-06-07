package io.koravo.task.service;

import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.CompleteTaskCommand;
import io.koravo.engine.dto.TaskDTO;
import io.koravo.form.service.FormBindingService;
import io.koravo.form.service.FormSnapshotService;
import io.koravo.form.service.FormSchemaService;
import io.koravo.form.web.FormBindingResponse;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.task.web.CompleteTaskRequest;
import io.koravo.tenant.TenantContextHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class TaskAppServiceTest {
    private final ProcessFacade processFacade = mock(ProcessFacade.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final FormSnapshotService formSnapshotService = mock(FormSnapshotService.class);
    private final FormBindingService formBindingService = mock(FormBindingService.class);
    private final FormSchemaService formSchemaService = mock(FormSchemaService.class);
    private final TaskAppService service = new TaskAppService(
            processFacade,
            auditLogService,
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
    void getTaskDetailReturnsBoundFormSchema() {
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

        var detail = service.getTaskDetail("task-1");

        assertThat(detail.task().taskId()).isEqualTo("task-1");
        assertThat(detail.formBinding().formSchemaId()).isEqualTo("form-1");
        assertThat(detail.formSchema().schemaJson()).contains("object");
    }
}
