package io.koravo.form.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.form.service.FormBindingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class FormBindingController {
    private final FormBindingService formBindingService;

    public FormBindingController(FormBindingService formBindingService) {
        this.formBindingService = formBindingService;
    }

    @PostMapping("/api/v1/form-bindings")
    public ApiResponse<FormBindingResponse> bind(@Valid @RequestBody FormBindingRequest request) {
        return ApiResponse.success(formBindingService.bind(request));
    }

    @GetMapping("/api/v1/form-bindings")
    public ApiResponse<List<FormBindingResponse>> list(@RequestParam(required = false) String processModelId) {
        return ApiResponse.success(formBindingService.list(processModelId));
    }

    @PutMapping("/api/v1/form-bindings/{id}")
    public ApiResponse<FormBindingResponse> update(@PathVariable String id, @Valid @RequestBody FormBindingRequest request) {
        return ApiResponse.success(formBindingService.update(id, request));
    }

    @DeleteMapping("/api/v1/form-bindings/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        formBindingService.delete(id);
        return ApiResponse.success(null);
    }
}
