package io.koravo.task.web;

import io.koravo.engine.dto.TaskDTO;
import io.koravo.form.web.FormBindingResponse;
import io.koravo.form.web.FormSchemaResponse;

public record TaskDetailResponse(
        TaskDTO task,
        FormBindingResponse formBinding,
        FormSchemaResponse formSchema
) {
}
