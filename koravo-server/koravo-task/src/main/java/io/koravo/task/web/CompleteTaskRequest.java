package io.koravo.task.web;

import java.util.Map;

public record CompleteTaskRequest(Map<String, Object> variables) {
}
