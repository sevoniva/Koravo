package io.koravo.engine.command;

public record DeployProcessCommand(
        String tenantId,
        String userId,
        String modelKey,
        String modelName,
        String fileName,
        String bpmnXml
) {
}
