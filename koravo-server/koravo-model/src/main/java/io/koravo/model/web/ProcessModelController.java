package io.koravo.model.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.engine.dto.ProcessDeploymentDTO;
import io.koravo.model.service.ProcessModelService;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Validated
@RestController
public class ProcessModelController {
    private final ProcessModelService processModelService;

    public ProcessModelController(ProcessModelService processModelService) {
        this.processModelService = processModelService;
    }

    @PostMapping(value = "/api/v1/process-models/deploy", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ProcessDeploymentDTO> deploy(
            @RequestParam(required = false) String modelName,
            @NotNull @RequestPart("file") MultipartFile file
    ) {
        return ApiResponse.success(processModelService.deploy(modelName, file));
    }
}
