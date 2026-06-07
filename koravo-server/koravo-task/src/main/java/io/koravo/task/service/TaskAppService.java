package io.koravo.task.service;

import io.koravo.common.api.PageResult;
import io.koravo.engine.api.ProcessFacade;
import io.koravo.engine.command.CompleteTaskCommand;
import io.koravo.engine.command.TaskQueryCommand;
import io.koravo.engine.dto.TaskDTO;
import io.koravo.ops.audit.AuditLogService;
import io.koravo.security.UserContextHolder;
import io.koravo.tenant.TenantContextHolder;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class TaskAppService {
    private final ProcessFacade processFacade;
    private final AuditLogService auditLogService;

    public TaskAppService(ProcessFacade processFacade, AuditLogService auditLogService) {
        this.processFacade = processFacade;
        this.auditLogService = auditLogService;
    }

    public PageResult<TaskDTO> queryMyTasks(int page, int pageSize) {
        return processFacade.queryMyTasks(new TaskQueryCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                page,
                pageSize
        ));
    }

    public void completeTask(String taskId, Map<String, Object> variables) {
        processFacade.completeTask(new CompleteTaskCommand(
                TenantContextHolder.getTenantId(),
                UserContextHolder.getUserId(),
                taskId,
                variables
        ));
        auditLogService.record("TASK_COMPLETE", "TASK", taskId, Map.of("taskId", taskId));
    }
}
