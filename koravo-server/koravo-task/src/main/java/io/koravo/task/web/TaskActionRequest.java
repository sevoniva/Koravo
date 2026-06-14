package io.koravo.task.web;

import jakarta.validation.constraints.NotBlank;

public record TaskActionRequest(
        @NotBlank String action,
        String targetUserId,
        String comment
) {
}
