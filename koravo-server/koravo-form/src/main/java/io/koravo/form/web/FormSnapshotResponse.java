package io.koravo.form.web;

import java.time.Instant;

public record FormSnapshotResponse(
        String id,
        String processInstanceId,
        String taskId,
        String formSchemaId,
        Integer formSchemaVersion,
        String schemaJson,
        String uiSchemaJson,
        String dataJson,
        Instant createdAt
) {
}
