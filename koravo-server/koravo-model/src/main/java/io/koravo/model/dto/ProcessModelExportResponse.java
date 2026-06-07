package io.koravo.model.dto;

public record ProcessModelExportResponse(
        String fileName,
        String bpmnXml
) {
}
