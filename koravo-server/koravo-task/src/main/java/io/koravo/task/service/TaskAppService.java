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
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.task.web.CompleteTaskRequest;
import io.koravo.task.web.TaskDetailResponse;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
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
    private final ProcessModelRepository processModelRepository;

    public TaskAppService(
            ProcessFacade processFacade,
            AuditLogService auditLogService,
            AuditLogQueryService auditLogQueryService,
            FormSnapshotService formSnapshotService,
            FormBindingService formBindingService,
            FormSchemaService formSchemaService,
            ProcessModelRepository processModelRepository
    ) {
        this.processFacade = processFacade;
        this.auditLogService = auditLogService;
        this.auditLogQueryService = auditLogQueryService;
        this.formSnapshotService = formSnapshotService;
        this.formBindingService = formBindingService;
        this.formSchemaService = formSchemaService;
        this.processModelRepository = processModelRepository;
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

    @Transactional(readOnly = true)
    public TaskDetailResponse getTaskDetail(String taskId) {
        TaskDTO task = processFacade.getTaskForDetail(TenantContextHolder.getTenantId(), UserContextHolder.getUserId(), taskId);
        Optional<FormBindingResponse> binding = resolveFormBinding(task);
        FormSchemaResponse schema = binding
                .map(value -> formSchemaService.get(value.formSchemaId()))
                .orElse(null);
        return new TaskDetailResponse(
                task,
                binding.orElse(null),
                schema,
                processFacade.getProcessVariables(TenantContextHolder.getTenantId(), task.processInstanceId()),
                processFacade.getTaskVariablesForDetail(TenantContextHolder.getTenantId(), UserContextHolder.getUserId(), taskId),
                processFacade.getTaskComments(TenantContextHolder.getTenantId(), task.processInstanceId(), taskId),
                formSnapshotService.listByProcessInstance(task.processInstanceId()),
                auditLogQueryService.queryByResource("TASK", taskId, 20)
        );
    }

    @Transactional
    public void completeTask(String taskId, CompleteTaskRequest request) {
        CompleteTaskRequest safeRequest = request == null ? new CompleteTaskRequest(Map.of(), null, null, null) : request;
        TaskDTO task = processFacade.getTask(TenantContextHolder.getTenantId(), UserContextHolder.getUserId(), taskId);
        String formSchemaId = resolveFormSchemaId(task, safeRequest);
        FormSchemaResponse formSchema = StringUtils.hasText(formSchemaId) ? formSchemaService.get(formSchemaId) : null;
        if (safeRequest.formData() != null && StringUtils.hasText(formSchemaId)) {
            formSnapshotService.saveSnapshot(task.processInstanceId(), taskId, formSchemaId, formSchema, safeRequest.formData());
        }
        processFacade.completeTask(new CompleteTaskCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                taskId,
                safeRequest.variables() == null ? Map.of() : safeRequest.variables(),
                safeRequest.comment()
        ));
        auditLogService.record("TASK_COMPLETE", "TASK", taskId, taskCompleteAuditDetail(task, formSchemaId));
    }

    private String resolveFormSchemaId(TaskDTO task, CompleteTaskRequest request) {
        if (StringUtils.hasText(request.formSchemaId())) {
            return request.formSchemaId();
        }
        return resolveFormBinding(task)
                .map(FormBindingResponse::formSchemaId)
                .orElse(null);
    }

    private Optional<FormBindingResponse> resolveFormBinding(TaskDTO task) {
        Optional<FormBindingResponse> definitionBinding = formBindingService.findByProcessDefinitionTaskKey(
                task.processDefinitionId(),
                task.taskDefinitionKey()
        );
        if (definitionBinding.isPresent()) {
            return definitionBinding;
        }
        return processModelRepository.findFirstByTenantIdAndFlowableDefinitionIdAndDeletedFalseOrderByUpdatedAtDesc(
                        TenantContextHolder.getTenantId(),
                        task.processDefinitionId()
                )
                .flatMap(model -> formBindingService.findByProcessModelTaskKey(model.getId(), task.taskDefinitionKey()));
    }

    private Map<String, Object> taskCompleteAuditDetail(TaskDTO task, String formSchemaId) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("taskId", task.taskId());
        detail.put("processInstanceId", task.processInstanceId());
        detail.put("businessKey", task.businessKey());
        detail.put("taskDefinitionKey", task.taskDefinitionKey());
        if (StringUtils.hasText(formSchemaId)) {
            detail.put("formSchemaId", formSchemaId);
        }
        return detail;
    }
}
