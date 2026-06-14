package io.koravo.connector.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.api.PageResult;
import io.koravo.connector.log.ConnectorExecutionLogQueryService;
import io.koravo.connector.log.ConnectorExecutionLogResponse;
import io.koravo.connector.log.ConnectorExecutionRetryService;
import io.koravo.connector.log.ConnectorExecutionSummaryResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ConnectorExecutionLogController {
    private final ConnectorExecutionLogQueryService queryService;
    private final ConnectorExecutionRetryService retryService;

    public ConnectorExecutionLogController(
            ConnectorExecutionLogQueryService queryService,
            ConnectorExecutionRetryService retryService
    ) {
        this.queryService = queryService;
        this.retryService = retryService;
    }

    @GetMapping("/api/v1/connector-execution-logs")
    public ApiResponse<PageResult<ConnectorExecutionLogResponse>> query(
            @RequestParam(required = false) String connectorType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String requestId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.success(queryService.query(connectorType, status, requestId, page, pageSize));
    }

    @GetMapping("/api/v1/connector-execution-logs/summary")
    public ApiResponse<ConnectorExecutionSummaryResponse> summary(
            @RequestParam(required = false) String connectorType
    ) {
        return ApiResponse.success(queryService.summary(connectorType));
    }

    @GetMapping("/api/v1/connector-execution-logs/{id}")
    public ApiResponse<ConnectorExecutionLogResponse> get(@PathVariable String id) {
        return ApiResponse.success(queryService.get(id));
    }

    @PostMapping("/api/v1/connector-execution-logs/{id}/retry")
    public ApiResponse<ConnectorExecutionLogResponse> retry(@PathVariable String id) {
        return ApiResponse.success(queryService.toResponse(retryService.retry(id)));
    }
}
