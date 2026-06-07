package io.koravo.model.dto;

import jakarta.validation.constraints.NotBlank;

public record ProcessModelCreateRequest(
        @NotBlank String modelKey,
        @NotBlank String modelName,
        String description,
        String bpmnXml
) {
}
