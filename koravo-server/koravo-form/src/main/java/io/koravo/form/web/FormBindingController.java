package io.koravo.form.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.form.service.FormBindingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
}
