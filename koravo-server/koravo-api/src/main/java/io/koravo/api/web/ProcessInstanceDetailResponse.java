package io.koravo.api.web;

import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.TaskDTO;
import io.koravo.ops.audit.dto.AuditLogResponse;

import java.time.Instant;
import java.util.List;

public record ProcessInstanceDetailResponse(
        String instanceId,
        String processDefinitionId,
        String businessKey,
        String startUserId,
        Instant startTime,
        Instant endTime,
        String status,
        List<TaskDTO> currentTasks,
        List<AuditLogResponse> auditLogs
) {
    public static ProcessInstanceDetailResponse from(ProcessInstanceDetailDTO instance, List<AuditLogResponse> auditLogs) {
        return new ProcessInstanceDetailResponse(
                instance.instanceId(),
                instance.processDefinitionId(),
                instance.businessKey(),
                instance.startUserId(),
                instance.startTime(),
                instance.endTime(),
                instance.status(),
                instance.currentTasks(),
                auditLogs
        );
    }
}
