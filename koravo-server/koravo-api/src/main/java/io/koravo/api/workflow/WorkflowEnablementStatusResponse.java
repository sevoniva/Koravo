package io.koravo.api.workflow;

import java.util.Map;

public record WorkflowEnablementStatusResponse(
        boolean initialized,
        String tenantId,
        String userId,
        String processModelId,
        String processDefinitionId,
        String processDefinitionKey,
        String formSchemaId,
        String formBindingId,
        String message,
        WorkflowEnablementStepStatus process,
        WorkflowEnablementStepStatus form,
        WorkflowEnablementStepStatus binding,
        WorkflowEnablementStepStatus todo,
        WorkflowEnablementStepStatus audit,
        WorkflowEnablementStepStatus connector,
        Map<String, Object> defaultStartVariables
) {
    public record WorkflowEnablementStepStatus(
            boolean ready,
            String status,
            String message,
            String resourceId,
            long count
    ) {
    }
}
