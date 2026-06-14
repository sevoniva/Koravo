package io.koravo.model.validation;

import java.util.List;

public record BpmnValidationResult(
        boolean valid,
        List<BpmnValidationIssue> errors,
        List<BpmnValidationIssue> warnings
) {
    public static BpmnValidationResult of(List<BpmnValidationIssue> errors, List<BpmnValidationIssue> warnings) {
        return new BpmnValidationResult(errors.isEmpty(), List.copyOf(errors), List.copyOf(warnings));
    }
}
