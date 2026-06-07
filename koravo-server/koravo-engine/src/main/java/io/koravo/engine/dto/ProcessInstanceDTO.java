package io.koravo.engine.dto;

public record ProcessInstanceDTO(
        String instanceId,
        String processDefinitionId,
        String businessKey,
        String status
) {
}
