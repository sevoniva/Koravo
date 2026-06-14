package io.koravo.tenant;

public final class TenantContextHolder {
    public static final String DEFAULT_TENANT = "default";

    private static final ThreadLocal<TenantContext> CONTEXT = new ThreadLocal<>();

    private TenantContextHolder() {
    }

    public static void setTenantId(String tenantId) {
        CONTEXT.set(new TenantContext(tenantId == null || tenantId.isBlank() ? DEFAULT_TENANT : tenantId));
    }

    public static String getTenantId() {
        TenantContext context = CONTEXT.get();
        return context == null ? DEFAULT_TENANT : context.tenantId();
    }

    public static void clear() {
        CONTEXT.remove();
    }
}
