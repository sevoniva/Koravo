package io.koravo.api.demo;

import java.util.Map;

public record DemoStatusResponse(
        boolean initialized,
        String tenantId,
        String userId,
        String processModelId,
        String processDefinitionId,
        String processDefinitionKey,
        String formSchemaId,
        String formBindingId,
        String message,
        DemoStepStatus process,
        DemoStepStatus form,
        DemoStepStatus binding,
        DemoStepStatus todo,
        DemoStepStatus audit,
        DemoStepStatus connector,
        Map<String, Object> defaultStartVariables
) {
    public record DemoStepStatus(
            boolean ready,
            String status,
            String message,
            String resourceId,
            long count
    ) {
    }
}
