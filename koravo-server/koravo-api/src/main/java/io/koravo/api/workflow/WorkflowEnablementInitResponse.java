package io.koravo.api.workflow;

import java.util.List;

public record WorkflowEnablementInitResponse(
        boolean initialized,
        String processModelId,
        String processDefinitionId,
        String processDefinitionKey,
        String formSchemaId,
        String formBindingId,
        List<String> actions
) {
}
