package io.koravo.task.web;

import io.koravo.engine.dto.TaskDTO;
import io.koravo.engine.dto.TaskCommentDTO;
import io.koravo.form.web.FormBindingResponse;
import io.koravo.form.web.FormSchemaResponse;
import io.koravo.form.web.FormSnapshotResponse;
import io.koravo.ops.audit.dto.AuditLogResponse;

import java.util.List;
import java.util.Map;

public record TaskDetailResponse(
        TaskDTO task,
        FormBindingResponse formBinding,
        FormSchemaResponse formSchema,
        Map<String, Object> processVariables,
        Map<String, Object> taskVariables,
        List<TaskCommentDTO> comments,
        List<FormSnapshotResponse> formSnapshots,
        List<AuditLogResponse> auditLogs
) {
}
