package io.koravo.security;

public final class UserContextHolder {
    public static final String ANONYMOUS = "anonymous";
    public static final String ROLE_ADMIN = "admin";
    public static final String ROLE_APPLICANT = "applicant";
    public static final String ROLE_MANAGER = "manager";
    public static final String ROLE_FINANCE = "finance";
    public static final String ROLE_OPERATOR = "operator";

    private static final ThreadLocal<UserContext> CONTEXT = new ThreadLocal<>();

    private UserContextHolder() {
    }

    public static void setUserId(String userId) {
        setUser(userId, defaultRole(userId));
    }

    public static void setUser(String userId, String role) {
        String normalizedUserId = userId == null || userId.isBlank() ? ANONYMOUS : userId;
        CONTEXT.set(new UserContext(normalizedUserId, normalizeRole(role, normalizedUserId)));
    }

    public static String getUserId() {
        UserContext context = CONTEXT.get();
        return context == null ? ANONYMOUS : context.userId();
    }

    public static String getRole() {
        UserContext context = CONTEXT.get();
        return context == null ? ROLE_APPLICANT : context.role();
    }

    public static boolean hasRole(String... roles) {
        String currentRole = getRole();
        for (String role : roles) {
            if (currentRole.equals(role)) {
                return true;
            }
        }
        return false;
    }

    public static void clear() {
        CONTEXT.remove();
    }

    private static String normalizeRole(String role, String userId) {
        if (role == null || role.isBlank()) {
            return defaultRole(userId);
        }
        return switch (role.trim()) {
            case ROLE_ADMIN, ROLE_APPLICANT, ROLE_MANAGER, ROLE_FINANCE, ROLE_OPERATOR -> role.trim();
            default -> defaultRole(userId);
        };
    }

    private static String defaultRole(String userId) {
        if (ROLE_ADMIN.equals(userId)) {
            return ROLE_ADMIN;
        }
        if (ROLE_MANAGER.equals(userId) || "managerApprover".equals(userId)) {
            return ROLE_MANAGER;
        }
        if (ROLE_FINANCE.equals(userId) || "financeApprover".equals(userId)) {
            return ROLE_FINANCE;
        }
        if (ROLE_OPERATOR.equals(userId)) {
            return ROLE_OPERATOR;
        }
        return ROLE_APPLICANT;
    }
}
