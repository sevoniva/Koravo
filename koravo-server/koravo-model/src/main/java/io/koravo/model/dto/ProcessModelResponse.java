package io.koravo.model.dto;

import java.time.Instant;

public record ProcessModelResponse(
        String id,
        String tenantId,
        String modelKey,
        String modelName,
        String modelType,
        int version,
        String flowableDeploymentId,
        String flowableDefinitionId,
        String status,
        String description,
        String bpmnXml,
        String assetOrigin,
        Instant createdAt,
        Instant updatedAt
) {
}
