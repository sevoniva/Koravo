package io.koravo.model.validation;

public record BpmnValidationIssue(
        String code,
        String message,
        String elementId
) {
}
