package io.koravo.api.demo;

import java.util.List;

public record DemoInitResponse(
        boolean initialized,
        String processModelId,
        String processDefinitionId,
        String processDefinitionKey,
        String formSchemaId,
        String formBindingId,
        List<String> actions
) {
}
