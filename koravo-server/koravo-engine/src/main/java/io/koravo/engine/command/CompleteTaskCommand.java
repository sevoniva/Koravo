package io.koravo.engine.command;

import java.util.Map;

public record CompleteTaskCommand(
        String tenantId,
        String userId,
        String taskId,
        Map<String, Object> variables
) {
}
