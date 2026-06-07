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
import io.koravo.engine.dto.TaskCommentDTO;
import io.koravo.engine.dto.TaskDTO;
import org.flowable.engine.HistoryService;
import org.flowable.engine.IdentityService;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.history.HistoricProcessInstance;
import org.flowable.engine.history.HistoricActivityInstance;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.runtime.ProcessInstance;
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

@Service
public class FlowableProcessFacade implements ProcessFacade {
    private final RepositoryService repositoryService;
    private final RuntimeService runtimeService;
    private final TaskService taskService;
    private final HistoryService historyService;
    private final IdentityService identityService;

    public FlowableProcessFacade(
            RepositoryService repositoryService,
            RuntimeService runtimeService,
            TaskService taskService,
            HistoryService historyService,
            IdentityService identityService
    ) {
        this.repositoryService = repositoryService;
        this.runtimeService = runtimeService;
        this.taskService = taskService;
        this.historyService = historyService;
        this.identityService = identityService;
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
        long total = taskService.createTaskQuery()
                .taskTenantId(command.tenantId())
                .taskAssignee(command.userId())
                .count();
        List<TaskDTO> tasks = taskService.createTaskQuery()
                .taskTenantId(command.tenantId())
                .taskAssignee(command.userId())
                .orderByTaskCreateTime()
                .desc()
                .listPage(command.offset(), command.pageSize())
                .stream()
                .map(this::toTaskDTO)
                .toList();
        return PageResult.of(tasks, total, command.page(), command.pageSize());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<TaskDTO> queryDoneTasks(TaskQueryCommand command) {
        long total = historyService.createHistoricTaskInstanceQuery()
                .taskTenantId(command.tenantId())
                .taskAssignee(command.userId())
                .finished()
                .count();
        List<TaskDTO> tasks = historyService.createHistoricTaskInstanceQuery()
                .taskTenantId(command.tenantId())
                .taskAssignee(command.userId())
                .finished()
                .orderByHistoricTaskInstanceEndTime()
                .desc()
                .listPage(command.offset(), command.pageSize())
                .stream()
                .map(this::toTaskDTO)
                .toList();
        return PageResult.of(tasks, total, command.page(), command.pageSize());
    }

    @Override
    @Transactional(readOnly = true)
    public PageResult<ProcessInstanceDetailDTO> queryStartedInstances(TaskQueryCommand command) {
        long total = historyService.createHistoricProcessInstanceQuery()
                .processInstanceTenantId(command.tenantId())
                .startedBy(command.userId())
                .count();
        List<ProcessInstanceDetailDTO> instances = historyService.createHistoricProcessInstanceQuery()
                .processInstanceTenantId(command.tenantId())
                .startedBy(command.userId())
                .orderByProcessInstanceStartTime()
                .desc()
                .listPage(command.offset(), command.pageSize())
                .stream()
                .map(this::toInstanceDetail)
                .toList();
        return PageResult.of(instances, total, command.page(), command.pageSize());
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
                .taskAssignee(userId)
                .singleResult();
        if (runtimeTask != null) {
            return toTaskDTO(runtimeTask);
        }
        HistoricTaskInstance historicTask = historyService.createHistoricTaskInstanceQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .taskAssignee(userId)
                .singleResult();
        if (historicTask == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found or not assigned to current user");
        }
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
                .taskAssignee(userId)
                .singleResult();
        if (runtimeTask != null) {
            return taskService.getVariables(taskId);
        }
        HistoricTaskInstance historicTask = historyService.createHistoricTaskInstanceQuery()
                .taskId(taskId)
                .taskTenantId(tenantId)
                .taskAssignee(userId)
                .singleResult();
        if (historicTask == null) {
            throw new BusinessException(ErrorCode.TASK_NOT_FOUND, "Task not found or not assigned to current user");
        }
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
        long total = historyService.createHistoricProcessInstanceQuery()
                .processInstanceTenantId(command.tenantId())
                .count();
        List<ProcessInstanceDetailDTO> instances = historyService.createHistoricProcessInstanceQuery()
                .processInstanceTenantId(command.tenantId())
                .orderByProcessInstanceStartTime()
                .desc()
                .listPage(command.offset(), command.pageSize())
                .stream()
                .map(this::toInstanceDetail)
                .toList();
        return PageResult.of(instances, total, command.page(), command.pageSize());
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

    private Instant toInstant(java.util.Date date) {
        return date == null ? null : date.toInstant();
    }
}
