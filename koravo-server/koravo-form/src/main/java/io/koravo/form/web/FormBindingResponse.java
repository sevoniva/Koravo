package io.koravo.form.web;

public record FormBindingResponse(
        String id,
        String processModelId,
        String processDefinitionId,
        String taskDefinitionKey,
        String formSchemaId,
        int formSchemaVersion
) {
}
