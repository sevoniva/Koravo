package io.koravo.engine.command;

import java.time.Instant;

public record TaskQueryCommand(
        String tenantId,
        String userId,
        int page,
        int pageSize,
        String keyword,
        String status,
        Instant startTime,
        Instant endTime
) {
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
}
