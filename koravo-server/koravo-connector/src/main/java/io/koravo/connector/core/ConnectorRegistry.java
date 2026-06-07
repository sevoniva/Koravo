package io.koravo.connector.core;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ConnectorRegistry {
    private final Map<String, Connector> connectors = new ConcurrentHashMap<>();

    public ConnectorRegistry(List<Connector> connectorList) {
        connectorList.forEach(connector -> connectors.put(connector.type(), connector));
    }

    public Connector get(String type) {
        Connector connector = connectors.get(type);
        if (connector == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Connector not found: " + type);
        }
        return connector;
    }
}
