package io.koravo.form.web;

import jakarta.validation.constraints.NotBlank;

public record FormSchemaRequest(
        @NotBlank String formKey,
        @NotBlank String formName,
        @NotBlank String schemaJson,
        String uiSchemaJson
) {
}
