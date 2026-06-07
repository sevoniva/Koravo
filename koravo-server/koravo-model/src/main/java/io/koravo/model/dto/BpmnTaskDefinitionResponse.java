package io.koravo.model.dto;

public record BpmnTaskDefinitionResponse(
        String taskDefinitionKey,
        String name,
        String type,
        String assignee
) {
}
