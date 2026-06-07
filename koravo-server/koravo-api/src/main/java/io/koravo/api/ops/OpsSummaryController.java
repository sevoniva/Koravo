package io.koravo.api.ops;

import io.koravo.common.api.ApiResponse;
import io.koravo.connector.log.ConnectorExecutionLogQueryService;
import io.koravo.ops.dto.OpsSummaryResponse;
import io.koravo.ops.service.ProcessOpsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OpsSummaryController {
    private final ProcessOpsService processOpsService;
    private final ConnectorExecutionLogQueryService connectorExecutionLogQueryService;

    public OpsSummaryController(
            ProcessOpsService processOpsService,
            ConnectorExecutionLogQueryService connectorExecutionLogQueryService
    ) {
        this.processOpsService = processOpsService;
        this.connectorExecutionLogQueryService = connectorExecutionLogQueryService;
    }

    @GetMapping("/api/v1/ops/summary")
    public ApiResponse<OpsSummaryResponse> summary() {
        return ApiResponse.success(processOpsService.summary(connectorExecutionLogQueryService.summary(null).failed()));
    }
}
