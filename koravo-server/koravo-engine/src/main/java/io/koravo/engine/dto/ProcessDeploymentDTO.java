package io.koravo.engine.dto;

public record ProcessDeploymentDTO(
        String platformModelId,
        String deploymentId,
        String processDefinitionId,
        String processDefinitionKey,
        int version
) {
    public ProcessDeploymentDTO withPlatformModelId(String platformModelId) {
        return new ProcessDeploymentDTO(platformModelId, deploymentId, processDefinitionId, processDefinitionKey, version);
    }
}
