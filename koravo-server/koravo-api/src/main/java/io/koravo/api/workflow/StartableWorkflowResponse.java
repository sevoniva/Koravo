package io.koravo.api.workflow;

import io.koravo.form.web.FormSchemaResponse;

public record StartableWorkflowResponse(
        String processModelId,
        String processDefinitionId,
        String processDefinitionKey,
        String processName,
        String description,
        String startFormBindingId,
        FormSchemaResponse startFormSchema
) {
}
