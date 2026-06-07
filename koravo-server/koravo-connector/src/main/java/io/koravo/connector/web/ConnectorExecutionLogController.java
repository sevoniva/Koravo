package io.koravo.connector.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.api.PageResult;
import io.koravo.connector.log.ConnectorExecutionLogQueryService;
import io.koravo.connector.log.ConnectorExecutionLogResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ConnectorExecutionLogController {
    private final ConnectorExecutionLogQueryService queryService;

    public ConnectorExecutionLogController(ConnectorExecutionLogQueryService queryService) {
        this.queryService = queryService;
    }

    @GetMapping("/api/v1/connector-execution-logs")
    public ApiResponse<PageResult<ConnectorExecutionLogResponse>> query(
            @RequestParam(required = false) String connectorType,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.success(queryService.query(connectorType, status, page, pageSize));
    }
}
