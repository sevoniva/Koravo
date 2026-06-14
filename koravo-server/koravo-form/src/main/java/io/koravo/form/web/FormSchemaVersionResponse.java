package io.koravo.form.web;

import java.time.Instant;

public record FormSchemaVersionResponse(
        String id,
        String formSchemaId,
        int version,
        String formKey,
        String formName,
        String schemaJson,
        String uiSchemaJson,
        String createdBy,
        Instant createdAt
) {
}
