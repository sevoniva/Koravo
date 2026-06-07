package io.koravo.connector.http;

import java.net.URI;

public interface UrlAccessPolicy {
    boolean isAllowed(URI uri);
}
