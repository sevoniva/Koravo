package io.koravo.model.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.model.domain.ProcessModelStatus;
import io.koravo.model.dto.ProcessModelCreateRequest;
import io.koravo.model.dto.ProcessModelDeployResponse;
import io.koravo.model.dto.ProcessModelExportResponse;
import io.koravo.model.dto.ProcessModelImportRequest;
import io.koravo.model.dto.ProcessModelResponse;
import io.koravo.model.dto.ProcessModelUpdateRequest;
import io.koravo.model.dto.BpmnTaskDefinitionResponse;
import io.koravo.model.service.ProcessModelService;
import io.koravo.model.validation.BpmnValidationResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Validated
@RestController
public class ProcessModelController {
    private final ProcessModelService processModelService;

    public ProcessModelController(ProcessModelService processModelService) {
        this.processModelService = processModelService;
    }

    @PostMapping("/api/v1/process-models")
    public ApiResponse<ProcessModelResponse> create(@Valid @RequestBody ProcessModelCreateRequest request) {
        return ApiResponse.success(processModelService.create(request));
    }

    @PostMapping("/api/v1/process-models/import")
    public ApiResponse<ProcessModelResponse> importModel(@Valid @RequestBody ProcessModelImportRequest request) {
        return ApiResponse.success(processModelService.importModel(request));
    }

    @GetMapping("/api/v1/process-models")
    public ApiResponse<List<ProcessModelResponse>> list(@RequestParam(required = false) ProcessModelStatus status) {
        return ApiResponse.success(processModelService.list(status));
    }

    @GetMapping("/api/v1/process-models/{id}")
    public ApiResponse<ProcessModelResponse> get(@PathVariable String id) {
        return ApiResponse.success(processModelService.get(id));
    }

    @GetMapping("/api/v1/process-models/{id}/task-definitions")
    public ApiResponse<List<BpmnTaskDefinitionResponse>> taskDefinitions(@PathVariable String id) {
        return ApiResponse.success(processModelService.taskDefinitions(id));
    }

    @PutMapping("/api/v1/process-models/{id}")
    public ApiResponse<ProcessModelResponse> update(@PathVariable String id, @Valid @RequestBody ProcessModelUpdateRequest request) {
        return ApiResponse.success(processModelService.update(id, request));
    }

    @PostMapping("/api/v1/process-models/{id}/validate")
    public ApiResponse<BpmnValidationResult> validate(@PathVariable String id) {
        return ApiResponse.success(processModelService.validate(id));
    }

    @PostMapping("/api/v1/process-models/validate")
    public ApiResponse<BpmnValidationResult> validateXml(@RequestBody String bpmnXml) {
        return ApiResponse.success(processModelService.validateXml(bpmnXml));
    }

    @PostMapping("/api/v1/process-models/{id}/deploy")
    public ApiResponse<ProcessModelDeployResponse> deploy(@PathVariable String id) {
        return ApiResponse.success(processModelService.deploy(id));
    }

    @PostMapping("/api/v1/process-models/{id}/disable")
    public ApiResponse<ProcessModelResponse> disable(@PathVariable String id) {
        return ApiResponse.success(processModelService.disable(id));
    }

    @PostMapping("/api/v1/process-models/{id}/archive")
    public ApiResponse<ProcessModelResponse> archive(@PathVariable String id) {
        return ApiResponse.success(processModelService.archive(id));
    }

    @GetMapping("/api/v1/process-models/{id}/export")
    public ResponseEntity<byte[]> export(@PathVariable String id) {
        ProcessModelExportResponse export = processModelService.export(id);
        byte[] bytes = export.bpmnXml().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + export.fileName() + "\"")
                .contentType(MediaType.APPLICATION_XML)
                .body(bytes);
    }

    @PostMapping(value = "/api/v1/process-models/deploy", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ProcessDeploymentDTO> deploy(
            @RequestParam(required = false) String modelName,
            @NotNull @RequestPart("file") MultipartFile file
    ) {
        return ApiResponse.success(processModelService.deploy(modelName, file));
    }
}
