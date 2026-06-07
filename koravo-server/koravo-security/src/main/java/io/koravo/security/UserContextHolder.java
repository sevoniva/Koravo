package io.koravo.security;

public final class UserContextHolder {
    public static final String ANONYMOUS = "anonymous";

    private static final ThreadLocal<UserContext> CONTEXT = new ThreadLocal<>();

    private UserContextHolder() {
    }

    public static void setUserId(String userId) {
        CONTEXT.set(new UserContext(userId == null || userId.isBlank() ? ANONYMOUS : userId));
    }

    public static String getUserId() {
        UserContext context = CONTEXT.get();
        return context == null ? ANONYMOUS : context.userId();
    }

    public static void clear() {
        CONTEXT.remove();
    }
}
