package io.koravo.engine.dto;

import java.util.List;

public record ProcessTraceDTO(
        String instanceId,
        String processDefinitionId,
        String businessKey,
        String status,
        String bpmnXml,
        List<String> currentActivityIds,
        List<TaskDTO> currentTasks,
        List<ProcessTraceNodeDTO> timeline
) {
}
