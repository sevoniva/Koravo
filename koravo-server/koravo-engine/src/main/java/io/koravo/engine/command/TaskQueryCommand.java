package io.koravo.engine.command;

import java.time.Instant;
import java.util.Set;

public record TaskQueryCommand(
        String tenantId,
        String userId,
        String candidateGroup,
        int page,
        int pageSize,
        String keyword,
        String status,
        Instant startTime,
        Instant endTime,
        Set<String> processDefinitionKeys
) {
    public TaskQueryCommand {
        processDefinitionKeys = processDefinitionKeys == null ? Set.of() : Set.copyOf(processDefinitionKeys);
    }

    public TaskQueryCommand(
            String tenantId,
            String userId,
            int page,
            int pageSize,
            String keyword,
            String status,
            Instant startTime,
            Instant endTime
    ) {
        this(tenantId, userId, null, page, pageSize, keyword, status, startTime, endTime, Set.of());
    }

    public TaskQueryCommand(
            String tenantId,
            String userId,
            String candidateGroup,
            int page,
            int pageSize,
            String keyword,
            String status,
            Instant startTime,
            Instant endTime
    ) {
        this(tenantId, userId, candidateGroup, page, pageSize, keyword, status, startTime, endTime, Set.of());
    }

    public int offset() {
        return Math.max(page - 1, 0) * pageSize();
    }

    public int pageSize() {
        return pageSize <= 0 ? 20 : Math.min(pageSize, 200);
    }

    public boolean hasKeyword() {
        return keyword != null && !keyword.isBlank();
    }

    public boolean hasStatus() {
        return status != null && !status.isBlank();
    }

    public boolean hasCandidateGroup() {
        return candidateGroup != null && !candidateGroup.isBlank();
    }

    public boolean hasProcessDefinitionKeys() {
        return processDefinitionKeys != null && !processDefinitionKeys.isEmpty();
    }
}
