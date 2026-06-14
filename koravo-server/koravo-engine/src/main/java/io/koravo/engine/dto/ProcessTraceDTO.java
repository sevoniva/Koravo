package io.koravo.engine.dto;

import java.util.List;
import java.util.Map;

public record ProcessTraceDTO(
        String instanceId,
        String processDefinitionId,
        String businessKey,
        String status,
        String bpmnXml,
        Map<String, Object> variables,
        List<String> currentActivityIds,
        List<TaskDTO> currentTasks,
        List<ProcessTraceNodeDTO> timeline
) {
}
