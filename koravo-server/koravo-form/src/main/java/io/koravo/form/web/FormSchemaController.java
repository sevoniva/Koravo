package io.koravo.form.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.form.service.FormSchemaService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class FormSchemaController {
    private final FormSchemaService formSchemaService;

    public FormSchemaController(FormSchemaService formSchemaService) {
        this.formSchemaService = formSchemaService;
    }

    @PostMapping("/api/v1/forms/schemas")
    public ApiResponse<FormSchemaResponse> create(@Valid @RequestBody FormSchemaRequest request) {
        return ApiResponse.success(formSchemaService.create(request));
    }

    @GetMapping("/api/v1/forms/schemas")
    public ApiResponse<List<FormSchemaResponse>> list() {
        return ApiResponse.success(formSchemaService.list());
    }

    @GetMapping("/api/v1/forms/schemas/{id}")
    public ApiResponse<FormSchemaResponse> get(@PathVariable String id) {
        return ApiResponse.success(formSchemaService.get(id));
    }

    @PutMapping("/api/v1/forms/schemas/{id}")
    public ApiResponse<FormSchemaResponse> update(@PathVariable String id, @Valid @RequestBody FormSchemaRequest request) {
        return ApiResponse.success(formSchemaService.update(id, request));
    }
}
