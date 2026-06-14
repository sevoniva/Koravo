package io.koravo.common.web;

public final class RequestContextHolder {
    private static final ThreadLocal<String> REQUEST_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> CLIENT_IP = new ThreadLocal<>();

    private RequestContextHolder() {
    }

    public static void set(String requestId, String clientIp) {
        REQUEST_ID.set(requestId);
        CLIENT_IP.set(clientIp);
    }

    public static String getRequestId() {
        return REQUEST_ID.get();
    }

    public static String getClientIp() {
        return CLIENT_IP.get();
    }

    public static void clear() {
        REQUEST_ID.remove();
        CLIENT_IP.remove();
    }
}
