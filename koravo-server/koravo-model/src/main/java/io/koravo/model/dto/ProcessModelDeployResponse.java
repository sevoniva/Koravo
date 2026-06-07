package io.koravo.model.dto;

import io.koravo.engine.dto.ProcessDeploymentDTO;

public record ProcessModelDeployResponse(
        ProcessModelResponse model,
        ProcessDeploymentDTO deployment
) {
}
