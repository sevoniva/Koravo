package io.koravo.engine.dto;

import java.time.Instant;

public record OpsJobDTO(
        String id,
        String type,
        String tenantId,
        String processInstanceId,
        String processDefinitionId,
        String executionId,
        String elementId,
        String elementName,
        String handlerType,
        String handlerConfiguration,
        int retries,
        String exceptionMessage,
        String exceptionStacktrace,
        Instant dueDate,
        Instant createTime
) {
}
