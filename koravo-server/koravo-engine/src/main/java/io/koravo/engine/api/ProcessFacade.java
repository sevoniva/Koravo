package io.koravo.engine.api;

import io.koravo.common.api.PageResult;
import io.koravo.engine.command.CompleteTaskCommand;
import io.koravo.engine.command.DeployProcessCommand;
import io.koravo.engine.command.InstanceQueryCommand;
import io.koravo.engine.command.StartProcessCommand;
import io.koravo.engine.command.TaskQueryCommand;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.engine.dto.ProcessInstanceDTO;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.ProcessTraceDTO;
import io.koravo.engine.dto.OpsJobDTO;
import io.koravo.engine.dto.TaskCommentDTO;
import io.koravo.engine.dto.TaskDTO;

import java.util.List;
import java.util.Map;

public interface ProcessFacade {
    ProcessDeploymentDTO deploy(DeployProcessCommand command);

    ProcessInstanceDTO start(StartProcessCommand command);

    PageResult<TaskDTO> queryMyTasks(TaskQueryCommand command);

    PageResult<TaskDTO> queryDoneTasks(TaskQueryCommand command);

    PageResult<ProcessInstanceDetailDTO> queryStartedInstances(TaskQueryCommand command);

    TaskDTO getTask(String tenantId, String userId, String taskId);

    TaskDTO getTaskForDetail(String tenantId, String userId, String taskId);

    Map<String, Object> getTaskVariables(String tenantId, String userId, String taskId);

    Map<String, Object> getTaskVariablesForDetail(String tenantId, String userId, String taskId);

    Map<String, Object> getProcessVariables(String tenantId, String instanceId);

    List<TaskCommentDTO> getTaskComments(String tenantId, String processInstanceId, String taskId);

    void completeTask(CompleteTaskCommand command);

    ProcessInstanceDetailDTO getInstance(String tenantId, String instanceId);

    ProcessTraceDTO getInstanceTrace(String tenantId, String instanceId);

    PageResult<ProcessInstanceDetailDTO> listInstances(InstanceQueryCommand command);

    long countRunningInstances(String tenantId);

    long countFailedJobs(String tenantId);

    long countDeadLetterJobs(String tenantId);

    PageResult<OpsJobDTO> listFailedJobs(String tenantId, int page, int pageSize);

    PageResult<OpsJobDTO> listDeadLetterJobs(String tenantId, int page, int pageSize);

    OpsJobDTO getFailedJob(String tenantId, String jobId);

    OpsJobDTO getDeadLetterJob(String tenantId, String jobId);

    void retryFailedJob(String tenantId, String jobId, int retries);

    void retryDeadLetterJob(String tenantId, String jobId, int retries);

    void deleteFailedJob(String tenantId, String jobId);

    void deleteDeadLetterJob(String tenantId, String jobId);

    void terminateProcessInstance(String tenantId, String instanceId, String reason);

    void suspendProcessInstance(String tenantId, String instanceId);

    void activateProcessInstance(String tenantId, String instanceId);
}
