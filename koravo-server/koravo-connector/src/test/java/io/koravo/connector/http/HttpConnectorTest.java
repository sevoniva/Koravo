package io.koravo.connector.http;

import com.sun.net.httpserver.HttpServer;
import io.koravo.connector.core.ConnectorContext;
import io.koravo.connector.core.ConnectorRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HttpConnectorTest {
    private HttpServer server;
    private HttpConnector connector;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/echo", exchange -> {
            byte[] body = exchange.getRequestBody().readAllBytes();
            String response = exchange.getRequestMethod() + " " + new String(body);
            exchange.getResponseHeaders().add("Content-Type", "text/plain");
            exchange.sendResponseHeaders(201, response.getBytes().length);
            exchange.getResponseBody().write(response.getBytes());
            exchange.close();
        });
        server.start();
        connector = new HttpConnector(new DefaultUrlAccessPolicy());
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void postSendsBodyAndReturnsResponse() {
        String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/echo";

        var response = connector.execute(
                new ConnectorRequest("POST", url, Map.of("X-Test", "koravo"), "{\"ok\":true}", Duration.ofSeconds(2)),
                new ConnectorContext("default", "admin", "req-1")
        );

        assertThat(response.statusCode()).isEqualTo(201);
        assertThat(response.body()).isEqualTo("POST {\"ok\":true}");
        assertThat(response.headers()).containsKey("content-type");
    }
}
