package io.koravo.engine.command;

public record TaskQueryCommand(
        String tenantId,
        String userId,
        int page,
        int pageSize
) {
    public int offset() {
        return Math.max(page - 1, 0) * pageSize();
    }

    public int pageSize() {
        return pageSize <= 0 ? 20 : Math.min(pageSize, 200);
    }
}
