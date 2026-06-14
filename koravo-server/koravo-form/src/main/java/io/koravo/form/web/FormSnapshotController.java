package io.koravo.form.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.form.service.FormSnapshotService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class FormSnapshotController {
    private final FormSnapshotService formSnapshotService;

    public FormSnapshotController(FormSnapshotService formSnapshotService) {
        this.formSnapshotService = formSnapshotService;
    }

    @GetMapping("/api/v1/forms/snapshots")
    public ApiResponse<List<FormSnapshotResponse>> listByProcessInstance(
            @RequestParam String processInstanceId
    ) {
        return ApiResponse.success(formSnapshotService.listByProcessInstance(processInstanceId));
    }
}
