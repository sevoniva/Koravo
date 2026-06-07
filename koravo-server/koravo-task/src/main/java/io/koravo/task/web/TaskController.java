package io.koravo.task.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.api.PageResult;
import io.koravo.engine.dto.TaskDTO;
import io.koravo.task.service.TaskAppService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class TaskController {
    private final TaskAppService taskAppService;

    public TaskController(TaskAppService taskAppService) {
        this.taskAppService = taskAppService;
    }

    @GetMapping("/api/v1/tasks/my")
    public ApiResponse<PageResult<TaskDTO>> myTasks(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize
    ) {
        return ApiResponse.success(taskAppService.queryMyTasks(page, pageSize));
    }

    @PostMapping("/api/v1/tasks/{taskId}/complete")
    public ApiResponse<Map<String, String>> complete(@PathVariable String taskId, @RequestBody CompleteTaskRequest request) {
        taskAppService.completeTask(taskId, request);
        return ApiResponse.success(Map.of("taskId", taskId, "status", "COMPLETED"));
    }
}
