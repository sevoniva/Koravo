package io.koravo.task.service;

import io.koravo.common.api.PageResult;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.common.model.AssetOrigin;
import io.koravo.common.workflow.RuntimeVisibilityPolicy;
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
import io.koravo.model.domain.KoProcessModel;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.repo.ProcessModelRepository;
import io.koravo.ops.audit.AuditLogQueryService;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.task.web.CompleteTaskRequest;
import io.koravo.task.web.TaskActionRequest;
import io.koravo.task.web.TaskDetailResponse;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

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

    public PageResult<TaskDTO> queryMyTasks(int page, int pageSize, String keyword, String status, Instant startTime, Instant endTime) {
        return processFacade.queryMyTasks(taskQueryCommand(page, pageSize, keyword, status, startTime, endTime));
    }

    public PageResult<TaskDTO> queryCandidateTasks(int page, int pageSize, String keyword, String status, Instant startTime, Instant endTime) {
        return queryCandidateTasks(page, pageSize, null, keyword, status, startTime, endTime);
    }

    public PageResult<TaskDTO> queryCandidateTasks(int page, int pageSize, String candidateGroup, String keyword, String status, Instant startTime, Instant endTime) {
        return processFacade.queryCandidateTasks(taskQueryCommand(
                StringUtils.hasText(candidateGroup) ? candidateGroup.trim() : UserContextHolder.getRole(),
                page,
                pageSize,
                keyword,
                status,
                startTime,
                endTime
        ));
    }

    public PageResult<TaskDTO> queryDoneTasks(int page, int pageSize, String keyword, String status, Instant startTime, Instant endTime) {
        return processFacade.queryDoneTasks(taskQueryCommand(page, pageSize, keyword, status, startTime, endTime));
    }

    public PageResult<ProcessInstanceDetailDTO> queryStartedInstances(int page, int pageSize, String keyword, String status, Instant startTime, Instant endTime) {
        return processFacade.queryStartedInstances(taskQueryCommand(page, pageSize, keyword, status, startTime, endTime));
    }

    private TaskQueryCommand taskQueryCommand(int page, int pageSize, String keyword, String status, Instant startTime, Instant endTime) {
        return taskQueryCommand(null, page, pageSize, keyword, status, startTime, endTime);
    }

    private TaskQueryCommand taskQueryCommand(
            String candidateGroup,
            int page,
            int pageSize,
            String keyword,
            String status,
            Instant startTime,
            Instant endTime
    ) {
        return new TaskQueryCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                candidateGroup,
                page,
                pageSize,
                keyword,
                status,
                startTime,
                endTime,
                visibleProcessDefinitionKeys(),
                RuntimeVisibilityPolicy.HIDDEN_BUSINESS_KEY_PATTERNS
        );
    }

    private Set<String> visibleProcessDefinitionKeys() {
        List<KoProcessModel> models = processModelRepository
                .findByTenantIdAndStatusAndAssetOriginInAndDeletedFalseOrderByUpdatedAtDesc(
                        TenantContextHolder.getTenantId(),
                        ProcessModelStatus.DEPLOYED,
                        List.of(AssetOrigin.SYSTEM_TEMPLATE, AssetOrigin.USER_FLOW)
                );
        if (models == null || models.isEmpty()) {
            return Set.of();
        }
        return models.stream()
                .map(KoProcessModel::getModelKey)
                .filter(StringUtils::hasText)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    @Transactional(readOnly = true)
    public TaskDetailResponse getTaskDetail(String taskId) {
        TaskDTO task = processFacade.getTaskForDetail(TenantContextHolder.getTenantId(), UserContextHolder.getUserId(), taskId);
        Optional<FormBindingResponse> binding = resolveFormBinding(task);
        FormSchemaResponse schema = binding
                .map(this::resolveBoundSchema)
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
        Optional<FormBindingResponse> binding = resolveFormBinding(task);
        String formSchemaId = resolveFormSchemaId(binding, safeRequest);
        FormSchemaResponse formSchema = resolveFormSchema(formSchemaId, binding);
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

    @Transactional
    public TaskDTO handleTaskAction(String taskId, TaskActionRequest request) {
        if (request == null || !StringUtils.hasText(request.action())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Task action is required");
        }
        String tenantId = TenantContextHolder.getTenantId();
        String userId = UserContextHolder.getUserId();
        String action = request.action().trim().toUpperCase();
        TaskDTO task = switch (action) {
            case "TRANSFER" -> processFacade.transferTask(
                    tenantId,
                    userId,
                    taskId,
                    requireTargetUser(request),
                    request.comment()
            );
            case "DELEGATE" -> processFacade.delegateTask(
                    tenantId,
                    userId,
                    taskId,
                    requireTargetUser(request),
                    request.comment()
            );
            case "CLAIM" -> processFacade.claimTask(tenantId, userId, taskId, request.comment());
            default -> throw new BusinessException(ErrorCode.BAD_REQUEST, "Unsupported task action: " + request.action());
        };
        auditLogService.record("TASK_" + action, "TASK", taskId, taskActionAuditDetail(task, action, request.targetUserId()));
        return task;
    }

    private String requireTargetUser(TaskActionRequest request) {
        if (!StringUtils.hasText(request.targetUserId())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Target user is required");
        }
        return request.targetUserId().trim();
    }

    private String resolveFormSchemaId(Optional<FormBindingResponse> binding, CompleteTaskRequest request) {
        if (StringUtils.hasText(request.formSchemaId())) {
            return request.formSchemaId();
        }
        return binding
                .map(FormBindingResponse::formSchemaId)
                .orElse(null);
    }

    private FormSchemaResponse resolveFormSchema(String formSchemaId, Optional<FormBindingResponse> binding) {
        if (!StringUtils.hasText(formSchemaId)) {
            return null;
        }
        if (binding.isPresent() && formSchemaId.equals(binding.get().formSchemaId())) {
            return resolveBoundSchema(binding.get());
        }
        return formSchemaService.get(formSchemaId);
    }

    private FormSchemaResponse resolveBoundSchema(FormBindingResponse binding) {
        return formSchemaService.get(binding.formSchemaId(), binding.formSchemaVersion());
    }

    private Optional<FormBindingResponse> resolveFormBinding(TaskDTO task) {
        Optional<FormBindingResponse> definitionBinding = formBindingService.findByProcessDefinitionTaskKey(
                task.processDefinitionId(),
                task.taskDefinitionKey()
        );
        if (definitionBinding != null && definitionBinding.isPresent()) {
            return definitionBinding;
        }
        Optional<KoProcessModel> model = processModelRepository
                .findFirstByTenantIdAndFlowableDefinitionIdAndDeletedFalseOrderByUpdatedAtDesc(
                        TenantContextHolder.getTenantId(),
                        task.processDefinitionId()
                );
        if (model == null) {
            return Optional.empty();
        }
        return model
                .flatMap(processModel -> formBindingService.findByProcessModelTaskKey(processModel.getId(), task.taskDefinitionKey()));
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

    private Map<String, Object> taskActionAuditDetail(TaskDTO task, String action, String targetUserId) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("action", action);
        detail.put("taskId", task.taskId());
        detail.put("processInstanceId", task.processInstanceId());
        detail.put("businessKey", task.businessKey());
        detail.put("taskDefinitionKey", task.taskDefinitionKey());
        detail.put("assignee", task.assignee());
        if (StringUtils.hasText(targetUserId)) {
            detail.put("targetUserId", targetUserId);
        }
        return detail;
    }
}
