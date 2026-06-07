package io.koravo.model.dto;

import jakarta.validation.constraints.NotBlank;

public record ProcessModelUpdateRequest(
        @NotBlank String modelName,
        String description,
        @NotBlank String bpmnXml
) {
}
