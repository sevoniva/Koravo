package io.koravo.datahub.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.api.PageResult;
import io.koravo.datahub.dto.DataSourceTestLogResponse;
import io.koravo.datahub.service.DataSourceService;
import io.koravo.datahub.service.DataSourceTestLogService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class DataSourceController {
    private final DataSourceService dataSourceService;
    private final DataSourceTestLogService testLogService;

    public DataSourceController(DataSourceService dataSourceService, DataSourceTestLogService testLogService) {
        this.dataSourceService = dataSourceService;
        this.testLogService = testLogService;
    }

    @PostMapping("/api/v1/datasources")
    public ApiResponse<DataSourceResponse> create(@Valid @RequestBody DataSourceCreateRequest request) {
        return ApiResponse.success(dataSourceService.create(request));
    }

    @GetMapping("/api/v1/datasources")
    public ApiResponse<List<DataSourceResponse>> list() {
        return ApiResponse.success(dataSourceService.list());
    }

    @GetMapping("/api/v1/datasources/{id}")
    public ApiResponse<DataSourceResponse> get(@PathVariable String id) {
        return ApiResponse.success(dataSourceService.get(id));
    }

    @PutMapping("/api/v1/datasources/{id}")
    public ApiResponse<DataSourceResponse> update(@PathVariable String id, @Valid @RequestBody DataSourceCreateRequest request) {
        return ApiResponse.success(dataSourceService.update(id, request));
    }

    @DeleteMapping("/api/v1/datasources/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        dataSourceService.delete(id);
        return ApiResponse.success(null);
    }

    @PostMapping("/api/v1/datasources/{id}/test")
    public ApiResponse<DataSourceTestResponse> test(@PathVariable String id) {
        return ApiResponse.success(dataSourceService.test(id));
    }

    @GetMapping("/api/v1/datasources/{id}/test-logs")
    public ApiResponse<PageResult<DataSourceTestLogResponse>> testLogs(
            @PathVariable String id,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.success(testLogService.list(id, page, pageSize));
    }
}
