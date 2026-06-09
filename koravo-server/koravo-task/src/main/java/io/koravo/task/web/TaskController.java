package io.koravo.task.web;

import io.koravo.common.api.ApiResponse;
import io.koravo.common.api.PageResult;
import io.koravo.engine.dto.ProcessInstanceDetailDTO;
import io.koravo.engine.dto.TaskDTO;
import io.koravo.task.service.TaskAppService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
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
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endTime
    ) {
        return ApiResponse.success(taskAppService.queryMyTasks(page, pageSize, keyword, status, startTime, endTime));
    }

    @GetMapping("/api/v1/tasks/done")
    public ApiResponse<PageResult<TaskDTO>> doneTasks(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endTime
    ) {
        return ApiResponse.success(taskAppService.queryDoneTasks(page, pageSize, keyword, status, startTime, endTime));
    }

    @GetMapping("/api/v1/tasks/started")
    public ApiResponse<PageResult<ProcessInstanceDetailDTO>> startedInstances(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant endTime
    ) {
        return ApiResponse.success(taskAppService.queryStartedInstances(page, pageSize, keyword, status, startTime, endTime));
    }

    @GetMapping("/api/v1/tasks/{taskId}")
    public ApiResponse<TaskDetailResponse> detail(@PathVariable String taskId) {
        return ApiResponse.success(taskAppService.getTaskDetail(taskId));
    }

    @PostMapping("/api/v1/tasks/{taskId}/complete")
    public ApiResponse<Map<String, String>> complete(@PathVariable String taskId, @RequestBody CompleteTaskRequest request) {
        taskAppService.completeTask(taskId, request);
        return ApiResponse.success(Map.of("taskId", taskId, "status", "COMPLETED"));
    }

    @PostMapping("/api/v1/tasks/{taskId}/actions")
    public ApiResponse<TaskDTO> action(@PathVariable String taskId, @RequestBody TaskActionRequest request) {
        return ApiResponse.success(taskAppService.handleTaskAction(taskId, request));
    }
}
