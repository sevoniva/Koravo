package io.koravo.engine.command;

import java.util.Map;

public record StartProcessCommand(
        String tenantId,
        String userId,
        String requestId,
        String processDefinitionKey,
        String businessKey,
        Map<String, Object> variables
) {
}
