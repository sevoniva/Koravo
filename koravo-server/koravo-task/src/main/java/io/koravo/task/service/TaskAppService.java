package io.koravo.task.service;

import io.koravo.common.api.PageResult;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.CompleteTaskCommand;
import io.koravo.engine.command.TaskQueryCommand;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.TaskDTO;
import io.koravo.form.service.FormBindingService;
import io.koravo.form.service.FormSnapshotService;
import io.koravo.form.service.FormSchemaService;
import io.koravo.form.web.FormBindingResponse;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.task.web.CompleteTaskRequest;
import io.koravo.task.web.TaskDetailResponse;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Map;
import java.util.Optional;

@Service
public class TaskAppService {
    private final ProcessFacade processFacade;
    private final AuditLogService auditLogService;
    private final AuditLogQueryService auditLogQueryService;
    private final FormSnapshotService formSnapshotService;
    private final FormBindingService formBindingService;
    private final FormSchemaService formSchemaService;

    public TaskAppService(
            ProcessFacade processFacade,
            AuditLogService auditLogService,
            AuditLogQueryService auditLogQueryService,
            FormSnapshotService formSnapshotService,
            FormBindingService formBindingService,
            FormSchemaService formSchemaService
    ) {
        this.processFacade = processFacade;
        this.auditLogService = auditLogService;
        this.auditLogQueryService = auditLogQueryService;
        this.formSnapshotService = formSnapshotService;
        this.formBindingService = formBindingService;
        this.formSchemaService = formSchemaService;
    }

    public PageResult<TaskDTO> queryMyTasks(int page, int pageSize) {
        return processFacade.queryMyTasks(new TaskQueryCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                page,
                pageSize
        ));
    }

    public PageResult<TaskDTO> queryDoneTasks(int page, int pageSize) {
        return processFacade.queryDoneTasks(new TaskQueryCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                page,
                pageSize
        ));
    }

    public PageResult<ProcessInstanceDetailDTO> queryStartedInstances(int page, int pageSize) {
        return processFacade.queryStartedInstances(new TaskQueryCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                page,
                pageSize
        ));
    }

    public TaskDetailResponse getTaskDetail(String taskId) {
        TaskDTO task = processFacade.getTask(TenantContextHolder.getTenantId(), UserContextHolder.getUserId(), taskId);
        Optional<FormBindingResponse> binding = formBindingService.findByProcessDefinitionTaskKey(
                task.processDefinitionId(),
                task.taskDefinitionKey()
        );
        FormSchemaResponse schema = binding
                .map(value -> formSchemaService.get(value.formSchemaId()))
                .orElse(null);
        return new TaskDetailResponse(
                task,
                binding.orElse(null),
                schema,
                processFacade.getProcessVariables(TenantContextHolder.getTenantId(), task.processInstanceId()),
                processFacade.getTaskVariables(TenantContextHolder.getTenantId(), UserContextHolder.getUserId(), taskId),
                processFacade.getTaskComments(TenantContextHolder.getTenantId(), task.processInstanceId(), taskId),
                formSnapshotService.listByProcessInstance(task.processInstanceId()),
                auditLogQueryService.queryByResource("TASK", taskId, 20)
        );
    }

    public void completeTask(String taskId, CompleteTaskRequest request) {
        CompleteTaskRequest safeRequest = request == null ? new CompleteTaskRequest(Map.of(), null, null, null) : request;
        TaskDTO task = processFacade.getTask(TenantContextHolder.getTenantId(), UserContextHolder.getUserId(), taskId);
        if (safeRequest.formData() != null && StringUtils.hasText(safeRequest.formSchemaId())) {
            formSnapshotService.saveSnapshot(task.processInstanceId(), taskId, safeRequest.formSchemaId(), safeRequest.formData());
        }
        processFacade.completeTask(new CompleteTaskCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                taskId,
                safeRequest.variables() == null ? Map.of() : safeRequest.variables(),
                safeRequest.comment()
        ));
        auditLogService.record("TASK_COMPLETE", "TASK", taskId, Map.of("taskId", taskId));
    }
}
