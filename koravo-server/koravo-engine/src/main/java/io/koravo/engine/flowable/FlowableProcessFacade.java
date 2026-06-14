package io.koravo.engine.flowable;

import io.koravo.common.api.PageResult;
import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.CompleteTaskCommand;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.command.InstanceQueryCommand;
import io.koravo.engine.command.StartProcessCommand;
import io.koravo.engine.command.TaskQueryCommand;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.engine.dto.ProcessInstanceDTO;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.ProcessTraceDTO;
import io.koravo.engine.dto.ProcessTraceNodeDTO;
import io.koravo.engine.dto.OpsJobDTO;
import io.koravo.engine.dto.TaskCommentDTO;
import io.koravo.engine.dto.TaskDTO;
import org.flowable.engine.HistoryService;
import org.flowable.engine.IdentityService;
import org.flowable.engine.ManagementService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.engine.history.HistoricActivityInstance;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.job.api.Job;
import org.flowable.task.api.Task;
import org.flowable.task.api.history.HistoricTaskInstance;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Service
public class FlowableProcessFacade implements ProcessFacade {
    private final RepositoryService repositoryService;
    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final HistoryService historyService;
    private final IdentityService identityService;
    private final ManagementService managementService;

    public FlowableProcessFacade(
            RepositoryService repositoryService,
            RuntimeService runtimeService,
            TaskService taskService,
            HistoryService historyService,
            IdentityService identityService,
            ManagementService managementService
    ) {
        this.repositoryService = repositoryService;
        this.runtimeService = runtimeService;
        this.taskService = taskService;
        this.historyService = historyService;
        this.identityService = identityService;
        this.managementService = managementService;
    }

    @Override
    @Transactional
    public ProcessDeploymentDTO deploy(DeployProcessCommand command) {
        String fileName = command.fileName() == null || command.fileName().isBlank()
                ? command.modelKey() + ".bpmn20.xml"
                : command.fileName();
        Deployment deployment = repositoryService.createDeployment()
                .name(command.modelName())
                .key(command.modelKey())
                .tenantId(command.tenantId())
                .addString(fileName, command.bpmnXml())
                .deploy();

        ProcessDefinition definition = repositoryService.createProcessDefinitionQuery()
                .deploymentId(deployment.getId())
                .singleResult();
        if (definition == null) {
            throw new BusinessException(ErrorCode.PROCESS_DEPLOY_FAILED, "No process definition found after deployment");
        }
        return new ProcessDeploymentDTO(null, deployment.getId(), definition.getId(), definition.getKey(), definition.getVersion());
    }

    @Override
    @Transactional
    public ProcessInstanceDTO start(StartProcessCommand command) {
        identityService.setAuthenticatedUserId(command.userId());
        try {
            Map<String, Object> variables = new HashMap<>(command.variables() == null ? Map.of() : command.variables());
            variables.putIfAbsent("tenantId", command.tenantId());
            variables.putIfAbsent("startUserId", command.userId());
            variables.putIfAbsent("approver", command.userId());
            variables.putIfAbsent("businessKey", command.businessKey());
            if (command.requestId() != null && !command.requestId().isBlank()) {
                variables.putIfAbsent("requestId", command.requestId());
            }

            ProcessInstance instance = runtimeService.startProcessInstanceByKeyAndTenantId(
                    command.processDefinitionKey(),
                    command.businessKey(),
                    variables,
                    command.tenantId()
            );
            return new ProcessInstanceDTO(instance.getId(), instance.getProcessDefinitionId(), instance.getBusinessKey(), "RUNNING");
        } finally {
            identityService.setAuthenticatedUserId(null);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<TaskDTO> queryMyTasks(TaskQueryCommand command) {
        List<TaskDTO> tasks = taskService.createTaskQuery()
                .taskTenantId(command.tenantId())
                .taskAssignee(command.userId())
                .orderByTaskCreateTime()
                .desc()
                .list()
                .stream()
                .map(this::toTaskDTO)
                .filter(task -> matchesTaskQuery(task, command))
                .toList();
        return page(tasks, command);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<TaskDTO> queryCandidateTasks(TaskQueryCommand command) {
        List<TaskDTO> tasks = new java.util.ArrayList<>();
        taskService.createTaskQuery()
                .taskTenantId(command.tenantId())
                .taskCandidateUser(command.userId())
                .orderByTaskCreateTime()
                .desc()
                .list()
                .stream()
                .map(this::toTaskDTO)
                .forEach(tasks::add);

        if (command.hasCandidateGroup()) {
            taskService.createTaskQuery()
                    .taskTenantId(command.tenantId())
                    .taskCandidateGroup(command.candidateGroup())
                    .orderByTaskCreateTime()
                    .desc()
                    .list()
                    .stream()
                    .map(this::toTaskDTO)
                    .forEach(tasks::add);
        }

        List<TaskDTO> candidateTasks = tasks.stream()
                .filter(task -> task.assignee() == null || task.assignee().isBlank())
                .collect(java.util.stream.Collectors.toMap(
                        TaskDTO::taskId,
                        task -> task,
                        (left, right) -> left,
                        java.util.LinkedHashMap::new
                ))
                .values()
                .stream()
                .filter(task -> matchesTaskQuery(task, command))
                .toList();
        return page(candidateTasks, command);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<TaskDTO> queryDoneTasks(TaskQueryCommand command) {
        List<TaskDTO> tasks = historyService.createHistoricTaskInstanceQuery()
                .taskTenantId(command.tenantId())
                .taskAssignee(command.userId())
                .finished()
                .orderByHistoricTaskInstanceEndTime()
                .desc()
                .list()
                .stream()
                .map(this::toTaskDTO)
                .filter(task -> matchesTaskQuery(task, command))
                .toList();
        return page(tasks, command);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<ProcessInstanceDetailDTO> queryStartedInstances(TaskQueryCommand command) {
        List<ProcessInstanceDetailDTO> instances = historyService.createHistoricProcessInstanceQuery()
                .processInstanceTenantId(command.tenantId())
                .startedBy(command.userId())
                .orderByProcessInstanceStartTime()
                .desc()
                .list()
                .stream()
                .map(this::toInstanceDetail)
                .filter(instance -> matchesStartedQuery(instance, command))
                .toList();
        return page(instances, command);
    }

    @Override
    @Transactional(readOnly = true)
    public TaskDTO getTask(String tenantId, String userId, String taskId) {
        Task task = taskService.createTaskQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .taskAssignee(userId)
                .singleResult();
        if (task == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found or not assigned to current user");
        }
        return toTaskDTO(task);
    }

    @Override
    @Transactional(readOnly = true)
    public TaskDTO getTaskForDetail(String tenantId, String userId, String taskId) {
        Task runtimeTask = taskService.createTaskQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .singleResult();
        if (runtimeTask != null) {
            assertTaskDetailVisible(tenantId, userId, runtimeTask.getAssignee(), runtimeTask.getProcessInstanceId());
            return toTaskDTO(runtimeTask);
        }
        HistoricTaskInstance historicTask = historyService.createHistoricTaskInstanceQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .singleResult();
        if (historicTask == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found");
        }
        assertTaskDetailVisible(tenantId, userId, historicTask.getAssignee(), historicTask.getProcessInstanceId());
        return toTaskDTO(historicTask);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getTaskVariables(String tenantId, String userId, String taskId) {
        Task task = taskService.createTaskQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .taskAssignee(userId)
                .singleResult();
        if (task == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found or not assigned to current user");
        }
        return taskService.getVariables(taskId);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getTaskVariablesForDetail(String tenantId, String userId, String taskId) {
        Task runtimeTask = taskService.createTaskQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .singleResult();
        if (runtimeTask != null) {
            assertTaskDetailVisible(tenantId, userId, runtimeTask.getAssignee(), runtimeTask.getProcessInstanceId());
            return taskService.getVariables(taskId);
        }
        HistoricTaskInstance historicTask = historyService.createHistoricTaskInstanceQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .singleResult();
        if (historicTask == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found");
        }
        assertTaskDetailVisible(tenantId, userId, historicTask.getAssignee(), historicTask.getProcessInstanceId());
        Map<String, Object> variables = new HashMap<>();
        historyService.createHistoricVariableInstanceQuery()
                .taskId(taskId)
                .list()
                .forEach(variable -> variables.put(variable.getVariableName(), variable.getValue()));
        return variables;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getProcessVariables(String tenantId, String instanceId) {
        ProcessInstance runtimeInstance = runtimeService.createProcessInstanceQuery()
                .processInstanceId(instanceId)
                .processInstanceTenantId(tenantId)
                .singleResult();
        if (runtimeInstance != null) {
            return runtimeService.getVariables(instanceId);
        }
        HistoricProcessInstance historic = historyService.createHistoricProcessInstanceQuery()
                .processInstanceId(instanceId)
                .processInstanceTenantId(tenantId)
                .singleResult();
        if (historic == null) {
            throw new BusinessException(ErrorCode.PROCESS_INSTANCE_NOT_FOUND, "Process instance not found");
        }
        Map<String, Object> variables = new HashMap<>();
        historyService.createHistoricVariableInstanceQuery()
                .processInstanceId(instanceId)
                .list()
                .forEach(variable -> variables.put(variable.getVariableName(), variable.getValue()));
        return variables;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TaskCommentDTO> getTaskComments(String tenantId, String processInstanceId, String taskId) {
        HistoricTaskInstance task = historyService.createHistoricTaskInstanceQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .processInstanceId(processInstanceId)
                .singleResult();
        if (task == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found");
        }
        return taskService.getTaskComments(taskId)
                .stream()
                .map(comment -> new TaskCommentDTO(
                        comment.getId(),
                        comment.getUserId(),
                        comment.getFullMessage(),
                        toInstant(comment.getTime())
                ))
                .toList();
    }

    @Override
    @Transactional
    public void completeTask(CompleteTaskCommand command) {
        Task task = taskService.createTaskQuery()
                .taskId(command.taskId())
                .taskTenantId(command.tenantId())
                .taskAssignee(command.userId())
                .singleResult();
        if (task == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found or not assigned to current user");
        }
        identityService.setAuthenticatedUserId(command.userId());
        try {
            if (command.comment() != null && !command.comment().isBlank()) {
                taskService.addComment(command.taskId(), task.getProcessInstanceId(), command.comment());
            }
            taskService.complete(command.taskId(), command.variables() == null ? Map.of() : command.variables());
        } finally {
            identityService.setAuthenticatedUserId(null);
        }
    }

    @Override
    @Transactional
    public TaskDTO transferTask(String tenantId, String userId, String taskId, String targetUserId, String comment) {
        Task task = assignedTask(tenantId, userId, taskId);
        identityService.setAuthenticatedUserId(userId);
        try {
            addTaskComment(taskId, task.getProcessInstanceId(), comment, "转交给 " + targetUserId);
            taskService.setAssignee(taskId, targetUserId);
            return toTaskDTO(taskService.createTaskQuery().taskId(taskId).taskTenantId(tenantId).singleResult());
        } finally {
            identityService.setAuthenticatedUserId(null);
        }
    }

    @Override
    @Transactional
    public TaskDTO delegateTask(String tenantId, String userId, String taskId, String targetUserId, String comment) {
        Task task = assignedTask(tenantId, userId, taskId);
        identityService.setAuthenticatedUserId(userId);
        try {
            addTaskComment(taskId, task.getProcessInstanceId(), comment, "委托给 " + targetUserId);
            taskService.delegateTask(taskId, targetUserId);
            return toTaskDTO(taskService.createTaskQuery().taskId(taskId).taskTenantId(tenantId).singleResult());
        } finally {
            identityService.setAuthenticatedUserId(null);
        }
    }

    @Override
    @Transactional
    public TaskDTO claimTask(String tenantId, String userId, String taskId, String comment) {
        Task task = taskService.createTaskQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .singleResult();
        if (task == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found");
        }
        if (task.getAssignee() != null && !task.getAssignee().isBlank() && !Objects.equals(task.getAssignee(), userId)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Task has already been assigned");
        }
        identityService.setAuthenticatedUserId(userId);
        try {
            if (task.getAssignee() == null || task.getAssignee().isBlank()) {
                taskService.claim(taskId, userId);
            }
            addTaskComment(taskId, task.getProcessInstanceId(), comment, "认领任务");
            return toTaskDTO(taskService.createTaskQuery().taskId(taskId).taskTenantId(tenantId).singleResult());
        } finally {
            identityService.setAuthenticatedUserId(null);
        }
    }

    private Task assignedTask(String tenantId, String userId, String taskId) {
        Task task = taskService.createTaskQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .taskAssignee(userId)
                .singleResult();
        if (task == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found or not assigned to current user");
        }
        return task;
    }

    private void assertTaskDetailVisible(String tenantId, String userId, String assignee, String processInstanceId) {
        if (Objects.equals(assignee, userId)) {
            return;
        }
        HistoricProcessInstance instance = historyService.createHistoricProcessInstanceQuery()
                .processInstanceId(processInstanceId)
                .processInstanceTenantId(tenantId)
                .singleResult();
        if (instance != null && Objects.equals(instance.getStartUserId(), userId)) {
            return;
        }
        throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found or not visible to current user");
    }

    private void addTaskComment(String taskId, String processInstanceId, String comment, String fallback) {
        String message = comment == null || comment.isBlank() ? fallback : comment;
        taskService.addComment(taskId, processInstanceId, message);
    }

    @Override
    @Transactional(readOnly = true)
    public ProcessInstanceDetailDTO getInstance(String tenantId, String instanceId) {
        HistoricProcessInstance historic = historyService.createHistoricProcessInstanceQuery()
                .processInstanceId(instanceId)
                .processInstanceTenantId(tenantId)
                .singleResult();
        if (historic == null) {
            throw new BusinessException(ErrorCode.PROCESS_INSTANCE_NOT_FOUND, "Process instance not found");
        }
        return toInstanceDetail(historic);
    }

    @Override
    @Transactional(readOnly = true)
    public ProcessTraceDTO getInstanceTrace(String tenantId, String instanceId) {
        HistoricProcessInstance historic = historyService.createHistoricProcessInstanceQuery()
                .processInstanceId(instanceId)
                .processInstanceTenantId(tenantId)
                .singleResult();
        if (historic == null) {
            throw new BusinessException(ErrorCode.PROCESS_INSTANCE_NOT_FOUND, "Process instance not found");
        }
        List<TaskDTO> currentTasks = taskService.createTaskQuery()
                .processInstanceId(historic.getId())
                .taskTenantId(tenantId)
                .list()
                .stream()
                .map(this::toTaskDTO)
                .toList();
        List<ProcessTraceNodeDTO> timeline = historyService.createHistoricActivityInstanceQuery()
                .processInstanceId(instanceId)
                .orderByHistoricActivityInstanceStartTime()
                .asc()
                .list()
                .stream()
                .map(this::toTraceNode)
                .toList();
        return new ProcessTraceDTO(
                historic.getId(),
                historic.getProcessDefinitionId(),
                historic.getBusinessKey(),
                toInstanceStatus(historic),
                readBpmnXml(historic.getProcessDefinitionId()),
                getProcessVariables(tenantId, instanceId),
                currentTasks.stream().map(TaskDTO::taskDefinitionKey).toList(),
                currentTasks,
                timeline
        );
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<ProcessInstanceDetailDTO> listInstances(InstanceQueryCommand command) {
        List<ProcessInstanceDetailDTO> instances = historyService.createHistoricProcessInstanceQuery()
                .processInstanceTenantId(command.tenantId())
                .orderByProcessInstanceStartTime()
                .desc()
                .list()
                .stream()
                .map(this::toInstanceDetail)
                .filter(instance -> matchesInstanceQuery(instance, command))
                .toList();
        return page(instances, command);
    }

    @Override
    @Transactional(readOnly = true)
    public long countRunningInstances(String tenantId) {
        return runtimeService.createProcessInstanceQuery()
                .processInstanceTenantId(tenantId)
                .count();
    }

    @Override
    @Transactional(readOnly = true)
    public long countFailedJobs(String tenantId) {
        return managementService.createJobQuery()
                .jobTenantId(tenantId)
                .withException()
                .count();
    }

    @Override
    @Transactional(readOnly = true)
    public long countDeadLetterJobs(String tenantId) {
        return managementService.createDeadLetterJobQuery()
                .jobTenantId(tenantId)
                .count();
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<OpsJobDTO> listFailedJobs(String tenantId, int page, int pageSize) {
        int safePage = Math.max(page, 1);
        int safePageSize = Math.max(pageSize, 1);
        long total = managementService.createJobQuery()
                .jobTenantId(tenantId)
                .withException()
                .count();
        List<OpsJobDTO> jobs = managementService.createJobQuery()
                .jobTenantId(tenantId)
                .withException()
                .orderByJobCreateTime()
                .desc()
                .listPage((safePage - 1) * safePageSize, safePageSize)
                .stream()
                .map(job -> toOpsJobDTO(job, "FAILED", null))
                .toList();
        return PageResult.of(jobs, total, safePage, safePageSize);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<OpsJobDTO> listDeadLetterJobs(String tenantId, int page, int pageSize) {
        int safePage = Math.max(page, 1);
        int safePageSize = Math.max(pageSize, 1);
        long total = managementService.createDeadLetterJobQuery()
                .jobTenantId(tenantId)
                .count();
        List<OpsJobDTO> jobs = managementService.createDeadLetterJobQuery()
                .jobTenantId(tenantId)
                .orderByJobCreateTime()
                .desc()
                .listPage((safePage - 1) * safePageSize, safePageSize)
                .stream()
                .map(job -> toOpsJobDTO(job, "DEAD_LETTER", null))
                .toList();
        return PageResult.of(jobs, total, safePage, safePageSize);
    }

    @Override
    @Transactional(readOnly = true)
    public OpsJobDTO getFailedJob(String tenantId, String jobId) {
        Job job = findFailedJob(tenantId, jobId);
        return toOpsJobDTO(job, "FAILED", managementService.getJobExceptionStacktrace(jobId));
    }

    @Override
    @Transactional(readOnly = true)
    public OpsJobDTO getDeadLetterJob(String tenantId, String jobId) {
        Job job = findDeadLetterJob(tenantId, jobId);
        return toOpsJobDTO(job, "DEAD_LETTER", managementService.getDeadLetterJobExceptionStacktrace(jobId));
    }

    @Override
    @Transactional
    public void retryFailedJob(String tenantId, String jobId, int retries) {
        findFailedJob(tenantId, jobId);
        managementService.setJobRetries(jobId, Math.max(retries, 1));
        managementService.executeJob(jobId);
    }

    @Override
    @Transactional
    public void retryDeadLetterJob(String tenantId, String jobId, int retries) {
        findDeadLetterJob(tenantId, jobId);
        managementService.moveDeadLetterJobToExecutableJob(jobId, Math.max(retries, 1));
    }

    @Override
    @Transactional
    public void deleteFailedJob(String tenantId, String jobId) {
        findFailedJob(tenantId, jobId);
        managementService.deleteJob(jobId);
    }

    @Override
    @Transactional
    public void deleteDeadLetterJob(String tenantId, String jobId) {
        findDeadLetterJob(tenantId, jobId);
        managementService.deleteDeadLetterJob(jobId);
    }

    @Override
    @Transactional
    public void terminateProcessInstance(String tenantId, String instanceId, String reason) {
        ensureRunningInstance(tenantId, instanceId);
        runtimeService.deleteProcessInstance(
                instanceId,
                reason == null || reason.isBlank() ? "Terminated by ops" : reason
        );
    }

    @Override
    @Transactional
    public void suspendProcessInstance(String tenantId, String instanceId) {
        ensureRunningInstance(tenantId, instanceId);
        runtimeService.suspendProcessInstanceById(instanceId);
    }

    @Override
    @Transactional
    public void activateProcessInstance(String tenantId, String instanceId) {
        ensureRunningInstance(tenantId, instanceId);
        runtimeService.activateProcessInstanceById(instanceId);
    }

    private ProcessInstanceDetailDTO toInstanceDetail(HistoricProcessInstance instance) {
        List<TaskDTO> currentTasks = taskService.createTaskQuery()
                .processInstanceId(instance.getId())
                .taskTenantId(instance.getTenantId())
                .list()
                .stream()
                .map(this::toTaskDTO)
                .toList();
        return new ProcessInstanceDetailDTO(
                instance.getId(),
                instance.getProcessDefinitionId(),
                instance.getBusinessKey(),
                instance.getStartUserId(),
                toInstant(instance.getStartTime()),
                toInstant(instance.getEndTime()),
                toInstanceStatus(instance),
                currentTasks
        );
    }

    private TaskDTO toTaskDTO(Task task) {
        String businessKey = null;
        HistoricProcessInstance instance = historyService.createHistoricProcessInstanceQuery()
                .processInstanceId(task.getProcessInstanceId())
                .singleResult();
        if (instance != null) {
            businessKey = instance.getBusinessKey();
        }
        return new TaskDTO(
                task.getId(),
                task.getName(),
                task.getProcessInstanceId(),
                task.getProcessDefinitionId(),
                businessKey,
                toInstant(task.getCreateTime()),
                task.getAssignee(),
                task.getTaskDefinitionKey(),
                "RUNNING"
        );
    }

    private TaskDTO toTaskDTO(HistoricTaskInstance task) {
        String businessKey = null;
        HistoricProcessInstance instance = historyService.createHistoricProcessInstanceQuery()
                .processInstanceId(task.getProcessInstanceId())
                .singleResult();
        if (instance != null) {
            businessKey = instance.getBusinessKey();
        }
        return new TaskDTO(
                task.getId(),
                task.getName(),
                task.getProcessInstanceId(),
                task.getProcessDefinitionId(),
                businessKey,
                toInstant(task.getCreateTime()),
                task.getAssignee(),
                task.getTaskDefinitionKey(),
                task.getEndTime() == null ? "RUNNING" : "COMPLETED"
        );
    }

    private ProcessTraceNodeDTO toTraceNode(HistoricActivityInstance activity) {
        return new ProcessTraceNodeDTO(
                activity.getActivityId(),
                activity.getActivityName(),
                activity.getActivityType(),
                toInstant(activity.getStartTime()),
                toInstant(activity.getEndTime()),
                activity.getEndTime() == null ? "ACTIVE" : "COMPLETED"
        );
    }

    private String readBpmnXml(String processDefinitionId) {
        ProcessDefinition definition = repositoryService.createProcessDefinitionQuery()
                .processDefinitionId(processDefinitionId)
                .singleResult();
        if (definition == null) {
            return null;
        }
        try (InputStream inputStream = repositoryService.getResourceAsStream(
                definition.getDeploymentId(),
                definition.getResourceName()
        )) {
            return inputStream == null ? null : new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Failed to read BPMN XML");
        }
    }

    private void ensureRunningInstance(String tenantId, String instanceId) {
        ProcessInstance instance = runtimeService.createProcessInstanceQuery()
                .processInstanceId(instanceId)
                .processInstanceTenantId(tenantId)
                .singleResult();
        if (instance == null) {
            throw new BusinessException(ErrorCode.PROCESS_INSTANCE_NOT_FOUND, "Running process instance not found");
        }
    }

    private String toInstanceStatus(HistoricProcessInstance instance) {
        if (instance.getEndTime() != null) {
            return "COMPLETED";
        }
        ProcessInstance runtimeInstance = runtimeService.createProcessInstanceQuery()
                .processInstanceId(instance.getId())
                .processInstanceTenantId(instance.getTenantId())
                .singleResult();
        return runtimeInstance != null && runtimeInstance.isSuspended() ? "SUSPENDED" : "RUNNING";
    }

    private boolean matchesTaskQuery(TaskDTO task, TaskQueryCommand command) {
        return matchesProcessDefinition(task.processDefinitionId(), command)
                && !matchesExcludedBusinessKey(task.businessKey(), command)
                && matchesStatus(task.status(), command)
                && matchesTime(task.createTime(), command)
                && matchesKeyword(command, task.name(), task.businessKey(), task.taskDefinitionKey(), task.assignee(), task.processInstanceId());
    }

    private boolean matchesStartedQuery(ProcessInstanceDetailDTO instance, TaskQueryCommand command) {
        return matchesProcessDefinition(instance.processDefinitionId(), command)
                && !matchesExcludedBusinessKey(instance.businessKey(), command)
                && matchesStatus(instance.status(), command)
                && matchesTime(instance.startTime(), command)
                && matchesKeyword(command, instance.businessKey(), instance.instanceId(), instance.processDefinitionId(), instance.startUserId());
    }

    private boolean matchesProcessDefinition(String processDefinitionId, TaskQueryCommand command) {
        if (!command.hasProcessDefinitionKeys()) {
            return true;
        }
        if (processDefinitionId == null || processDefinitionId.isBlank()) {
            return false;
        }
        return command.processDefinitionKeys().stream()
                .anyMatch(key -> processDefinitionId.equals(key) || processDefinitionId.startsWith(key + ":"));
    }

    private boolean matchesInstanceQuery(ProcessInstanceDetailDTO instance, InstanceQueryCommand command) {
        return matchesStatus(instance.status(), command)
                && !matchesExcludedProcessDefinition(instance.processDefinitionId(), command)
                && !matchesExcludedBusinessKey(instance.businessKey(), command)
                && matchesKeyword(command, instance.businessKey(), instance.instanceId(), instance.processDefinitionId(), instance.startUserId());
    }

    private boolean matchesExcludedProcessDefinition(String processDefinitionId, InstanceQueryCommand command) {
        if (!command.hasExcludedProcessDefinitionKeys()) {
            return false;
        }
        if (processDefinitionId == null || processDefinitionId.isBlank()) {
            return false;
        }
        return command.excludedProcessDefinitionKeys().stream()
                .anyMatch(pattern -> matchesExcludedProcessDefinitionPattern(processDefinitionId, pattern));
    }

    private boolean matchesExcludedProcessDefinitionPattern(String processDefinitionId, String pattern) {
        if (pattern == null || pattern.isBlank()) {
            return false;
        }
        String value = pattern.trim();
        if (value.endsWith("%") || value.endsWith("*")) {
            return processDefinitionId.startsWith(value.substring(0, value.length() - 1));
        }
        return processDefinitionId.equals(value) || processDefinitionId.startsWith(value + ":");
    }

    private boolean matchesExcludedBusinessKey(String businessKey, InstanceQueryCommand command) {
        return command.hasExcludedBusinessKeyPatterns()
                && matchesExcludedBusinessKey(businessKey, command.excludedBusinessKeyPatterns());
    }

    private boolean matchesExcludedBusinessKey(String businessKey, TaskQueryCommand command) {
        return command.hasExcludedBusinessKeyPatterns()
                && matchesExcludedBusinessKey(businessKey, command.excludedBusinessKeyPatterns());
    }

    private boolean matchesExcludedBusinessKey(String businessKey, Set<String> excludedBusinessKeyPatterns) {
        if (businessKey == null || businessKey.isBlank()) {
            return false;
        }
        return excludedBusinessKeyPatterns.stream()
                .anyMatch(pattern -> matchesExcludedBusinessKeyPattern(businessKey, pattern));
    }

    private boolean matchesExcludedBusinessKeyPattern(String businessKey, String pattern) {
        if (pattern == null || pattern.isBlank()) {
            return false;
        }
        String value = pattern.trim();
        if (value.endsWith("%") || value.endsWith("*")) {
            return businessKey.startsWith(value.substring(0, value.length() - 1));
        }
        return businessKey.equals(value);
    }

    private boolean matchesStatus(String status, TaskQueryCommand command) {
        return !command.hasStatus() || Objects.equals(normalize(status), normalize(command.status()));
    }

    private boolean matchesStatus(String status, InstanceQueryCommand command) {
        return !command.hasStatus() || Objects.equals(normalize(status), normalize(command.status()));
    }

    private boolean matchesTime(Instant value, TaskQueryCommand command) {
        if (value == null) {
            return command.startTime() == null && command.endTime() == null;
        }
        if (command.startTime() != null && value.isBefore(command.startTime())) {
            return false;
        }
        return command.endTime() == null || !value.isAfter(command.endTime());
    }

    private boolean matchesKeyword(TaskQueryCommand command, String... values) {
        if (!command.hasKeyword()) {
            return true;
        }
        return matchesKeyword(normalize(command.keyword()), values);
    }

    private boolean matchesKeyword(InstanceQueryCommand command, String... values) {
        if (!command.hasKeyword()) {
            return true;
        }
        return matchesKeyword(normalize(command.keyword()), values);
    }

    private boolean matchesKeyword(String keyword, String... values) {
        for (String value : values) {
            if (normalize(value).contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).trim();
    }

    private <T> PageResult<T> page(List<T> items, TaskQueryCommand command) {
        List<T> pageItems = items.stream()
                .skip(command.offset())
                .limit(command.pageSize())
                .toList();
        return PageResult.of(pageItems, items.size(), command.page(), command.pageSize());
    }

    private <T> PageResult<T> page(List<T> items, InstanceQueryCommand command) {
        List<T> pageItems = items.stream()
                .skip(command.offset())
                .limit(command.pageSize())
                .toList();
        return PageResult.of(pageItems, items.size(), command.page(), command.pageSize());
    }

    private Job findFailedJob(String tenantId, String jobId) {
        Job job = managementService.createJobQuery()
                .jobTenantId(tenantId)
                .jobId(jobId)
                .withException()
                .singleResult();
        if (job == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "失败任务不存在");
        }
        return job;
    }

    private Job findDeadLetterJob(String tenantId, String jobId) {
        Job job = managementService.createDeadLetterJobQuery()
                .jobTenantId(tenantId)
                .jobId(jobId)
                .singleResult();
        if (job == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "死信任务不存在");
        }
        return job;
    }

    private OpsJobDTO toOpsJobDTO(Job job, String type, String exceptionStacktrace) {
        return new OpsJobDTO(
                job.getId(),
                type,
                job.getTenantId(),
                job.getProcessInstanceId(),
                job.getProcessDefinitionId(),
                job.getExecutionId(),
                job.getElementId(),
                job.getElementName(),
                job.getJobHandlerType(),
                job.getJobHandlerConfiguration(),
                job.getRetries(),
                job.getExceptionMessage(),
                exceptionStacktrace,
                toInstant(job.getDuedate()),
                toInstant(job.getCreateTime())
        );
    }

    private Instant toInstant(java.util.Date date) {
        return date == null ? null : date.toInstant();
    }
}
