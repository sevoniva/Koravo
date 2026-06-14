package io.koravo.form.web;

public record FormSchemaResponse(
        String id,
        String formKey,
        String formName,
        int version,
        String schemaJson,
        String uiSchemaJson,
        String status,
        String assetOrigin
) {
}
