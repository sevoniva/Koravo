package io.koravo.engine.dto;

import java.time.Instant;

public record TaskDTO(
        String taskId,
        String name,
        String processInstanceId,
        String processDefinitionId,
        String businessKey,
        Instant createTime,
        String assignee,
        String taskDefinitionKey
) {
}
