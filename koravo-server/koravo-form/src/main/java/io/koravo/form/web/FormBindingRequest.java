package io.koravo.form.web;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record FormBindingRequest(
        String processModelId,
        String processDefinitionId,
        @NotBlank String taskDefinitionKey,
        @NotBlank String formSchemaId,
        @Min(1) int formSchemaVersion
) {
}
