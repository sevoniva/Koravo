package io.koravo.engine.command;

public record InstanceQueryCommand(
        String tenantId,
        int page,
        int pageSize,
        String keyword,
        String status
) {
    public InstanceQueryCommand(String tenantId, int page, int pageSize) {
        this(tenantId, page, pageSize, null, null);
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
}
