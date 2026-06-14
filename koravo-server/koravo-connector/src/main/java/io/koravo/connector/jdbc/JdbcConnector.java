package io.koravo.connector.jdbc;

import io.koravo.common.exception.BusinessException;
import io.koravo.common.exception.ErrorCode;
import io.koravo.connector.core.Connector;
import io.koravo.connector.core.ConnectorContext;
import io.koravo.connector.core.ConnectorRequest;
import io.koravo.connector.core.ConnectorResponse;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class JdbcConnector implements Connector {
    @Override
    public String type() {
        return "jdbc";
    }

    @Override
    public ConnectorResponse execute(ConnectorRequest request, ConnectorContext context) {
        throw new BusinessException(ErrorCode.BAD_REQUEST, "JDBC connector execution is reserved for a later release");
    }
}
