package io.koravo.ops.dto;

public record OpsCapabilityResponse(
        String key,
        String name,
        String status,
        String description
) {
}
