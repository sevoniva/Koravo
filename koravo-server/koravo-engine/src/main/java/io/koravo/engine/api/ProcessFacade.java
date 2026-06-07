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
import io.koravo.engine.dto.TaskDTO;

public interface ProcessFacade {
    ProcessDeploymentDTO deploy(DeployProcessCommand command);

    ProcessInstanceDTO start(StartProcessCommand command);

    PageResult<TaskDTO> queryMyTasks(TaskQueryCommand command);

    TaskDTO getTask(String tenantId, String userId, String taskId);

    void completeTask(CompleteTaskCommand command);

    ProcessInstanceDetailDTO getInstance(String tenantId, String instanceId);

    ProcessTraceDTO getInstanceTrace(String tenantId, String instanceId);

    PageResult<ProcessInstanceDetailDTO> listInstances(InstanceQueryCommand command);
}
