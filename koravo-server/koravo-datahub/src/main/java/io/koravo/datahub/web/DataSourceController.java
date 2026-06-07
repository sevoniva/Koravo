package io.koravo.datahub.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.datahub.service.DataSourceService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class DataSourceController {
    private final DataSourceService dataSourceService;

    public DataSourceController(DataSourceService dataSourceService) {
        this.dataSourceService = dataSourceService;
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

    @PostMapping("/api/v1/datasources/{id}/test")
    public ApiResponse<DataSourceTestResponse> test(@PathVariable String id) {
        return ApiResponse.success(dataSourceService.test(id));
    }
}
