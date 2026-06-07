package io.koravo.connector.http;

import org.springframework.stereotype.Component;

import java.net.URI;

@Component
public class DefaultUrlAccessPolicy implements UrlAccessPolicy {
    @Override
    public boolean isAllowed(URI uri) {
        if ("https".equalsIgnoreCase(uri.getScheme())) {
            return true;
        }
        return "http".equalsIgnoreCase(uri.getScheme()) && "localhost".equalsIgnoreCase(uri.getHost());
    }
}
