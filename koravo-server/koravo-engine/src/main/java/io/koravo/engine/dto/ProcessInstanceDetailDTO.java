package io.koravo.engine.dto;

import java.time.Instant;
import java.util.List;

public record ProcessInstanceDetailDTO(
        String instanceId,
        String processDefinitionId,
        String businessKey,
        String startUserId,
        Instant startTime,
        Instant endTime,
        String status,
        List<TaskDTO> currentTasks
) {
}
