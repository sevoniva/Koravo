package io.koravo.api.web;

import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public record StartProcessRequest(
        @NotBlank String processDefinitionKey,
        @NotBlank String businessKey,
        Map<String, Object> variables
) {
}
