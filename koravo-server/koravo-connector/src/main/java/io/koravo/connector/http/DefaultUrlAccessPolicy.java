package io.koravo.connector.http;

import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Locale;

@Component
public class DefaultUrlAccessPolicy implements UrlAccessPolicy {
    @Override
    public boolean isAllowed(URI uri) {
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (scheme == null || host == null || host.isBlank()) {
            return false;
        }
        String normalizedHost = host.toLowerCase(Locale.ROOT);
        if (isLocalhost(normalizedHost)) {
            return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
        }
        if (isPrivateOrLinkLocal(normalizedHost)) {
            return false;
        }
        return "https".equalsIgnoreCase(scheme);
    }

    private boolean isLocalhost(String host) {
        return "localhost".equals(host) || "127.0.0.1".equals(host) || "::1".equals(host) || "[::1]".equals(host);
    }

    private boolean isPrivateOrLinkLocal(String host) {
        return host.startsWith("10.")
                || host.startsWith("192.168.")
                || host.startsWith("169.254.")
                || host.startsWith("127.")
                || host.equals("0.0.0.0")
                || isCarrierGradeNat(host)
                || isPrivate172(host)
                || isPrivateOrLinkLocalIpv6(host)
                || host.equals("metadata.google.internal");
    }

    private boolean isCarrierGradeNat(String host) {
        if (!host.startsWith("100.")) {
            return false;
        }
        String[] parts = host.split("\\.");
        if (parts.length < 2) {
            return false;
        }
        try {
            int second = Integer.parseInt(parts[1]);
            return second >= 64 && second <= 127;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private boolean isPrivate172(String host) {
        if (!host.startsWith("172.")) {
            return false;
        }
        String[] parts = host.split("\\.");
        if (parts.length < 2) {
            return false;
        }
        try {
            int second = Integer.parseInt(parts[1]);
            return second >= 16 && second <= 31;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private boolean isPrivateOrLinkLocalIpv6(String host) {
        String normalized = host.startsWith("[") && host.endsWith("]")
                ? host.substring(1, host.length() - 1)
                : host;
        return normalized.regionMatches(true, 0, "fc", 0, 2)
                || normalized.regionMatches(true, 0, "fd", 0, 2)
                || isIpv6LinkLocal(normalized);
    }

    private boolean isIpv6LinkLocal(String host) {
        if (!host.regionMatches(true, 0, "fe", 0, 2) || host.length() < 3) {
            return false;
        }
        char third = Character.toLowerCase(host.charAt(2));
        return third >= '8' && third <= 'b';
    }
}
