package io.koravo.connector.http;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.connector.core.Connector;
import io.koravo.connector.core.ConnectorContext;
import io.koravo.connector.core.ConnectorRequest;
import io.koravo.connector.core.ConnectorResponse;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Locale;

@Component
public class HttpConnector implements Connector {
    private final UrlAccessPolicy urlAccessPolicy;

    public HttpConnector(UrlAccessPolicy urlAccessPolicy) {
        this.urlAccessPolicy = urlAccessPolicy;
    }

    @Override
    public String type() {
        return "http";
    }

    @Override
    public ConnectorResponse execute(ConnectorRequest request, ConnectorContext context) {
        try {
            URI uri = URI.create(request.url());
            if (!urlAccessPolicy.isAllowed(uri)) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "URL is not allowed by access policy");
            }
            Duration timeout = request.timeout() == null ? Duration.ofSeconds(5) : request.timeout();
            HttpRequest.Builder builder = HttpRequest.newBuilder(uri).timeout(timeout);
            if (request.headers() != null) {
                request.headers().forEach(builder::header);
            }
            String method = request.method() == null ? "GET" : request.method().toUpperCase(Locale.ROOT);
            if ("POST".equals(method)) {
                builder.POST(HttpRequest.BodyPublishers.ofString(request.body() == null ? "" : request.body()));
            } else if ("GET".equals(method)) {
                builder.GET();
            } else {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "Unsupported HTTP method: " + method);
            }
            HttpResponse<String> response = HttpClient.newBuilder()
                    .connectTimeout(timeout)
                    .build()
                    .send(builder.build(), HttpResponse.BodyHandlers.ofString());
            return new ConnectorResponse(response.statusCode(), response.headers().map(), response.body());
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "HTTP connector execution failed", e);
        }
    }
}
