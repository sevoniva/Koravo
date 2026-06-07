package io.koravo.connector.core;

public interface Connector {
    String type();

    ConnectorResponse execute(ConnectorRequest request, ConnectorContext context);
}
