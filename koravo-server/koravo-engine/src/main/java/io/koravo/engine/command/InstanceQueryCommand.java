package io.koravo.engine.command;

public record InstanceQueryCommand(
        String tenantId,
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
