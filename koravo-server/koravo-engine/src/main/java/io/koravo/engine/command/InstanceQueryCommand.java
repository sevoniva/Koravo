package io.koravo.engine.command;

import java.util.Set;

public record InstanceQueryCommand(
        String tenantId,
        int page,
        int pageSize,
        String keyword,
        String status,
        Set<String> excludedProcessDefinitionKeys
) {
    public InstanceQueryCommand {
        excludedProcessDefinitionKeys = excludedProcessDefinitionKeys == null ? Set.of() : Set.copyOf(excludedProcessDefinitionKeys);
    }

    public InstanceQueryCommand(String tenantId, int page, int pageSize, String keyword, String status) {
        this(tenantId, page, pageSize, keyword, status, Set.of());
    }

    public InstanceQueryCommand(String tenantId, int page, int pageSize) {
        this(tenantId, page, pageSize, null, null, Set.of());
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

    public boolean hasExcludedProcessDefinitionKeys() {
        return excludedProcessDefinitionKeys != null && !excludedProcessDefinitionKeys.isEmpty();
    }
}
