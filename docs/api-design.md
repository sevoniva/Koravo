# API Design

All APIs use `/api/v1` and return `ApiResponse`.

Success:

```json
{
  "success": true,
  "code": "OK",
  "message": "success",
  "data": {},
  "requestId": "..."
}
```

Error:

```json
{
  "success": false,
  "code": "MODEL_NOT_FOUND",
  "message": "Process model not found",
  "data": null,
  "requestId": "..."
}
```

## Implemented Endpoints

- `GET /api/v1/health`
- `GET /api/v1/system/health`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/workflow-enablement/status`
- `POST /api/v1/workflow-enablement/init`
- `GET /api/v1/process-models`
- `POST /api/v1/process-models`
- `POST /api/v1/process-models/import`
- `POST /api/v1/process-models/deploy`
- `GET /api/v1/process-models/{id}`
- `PUT /api/v1/process-models/{id}`
- `GET /api/v1/process-models/{id}/task-definitions`
- `POST /api/v1/process-models/validate`
- `POST /api/v1/process-models/{id}/validate`
- `POST /api/v1/process-models/{id}/deploy`
- `POST /api/v1/process-models/{id}/disable`
- `POST /api/v1/process-models/{id}/archive`
- `GET /api/v1/process-models/{id}/export`
- `POST /api/v1/process-instances/start`
- `GET /api/v1/process-instances/{instanceId}`
- `GET /api/v1/tasks/my`
- `GET /api/v1/tasks/done`
- `GET /api/v1/tasks/started`
- `GET /api/v1/tasks/{taskId}`
- `POST /api/v1/tasks/{taskId}/complete`
- `GET /api/v1/forms/schemas`
- `POST /api/v1/forms/schemas`
- `GET /api/v1/forms/schemas/{id}`
- `PUT /api/v1/forms/schemas/{id}`
- `GET /api/v1/forms/snapshots`
- `GET /api/v1/form-bindings`
- `POST /api/v1/form-bindings`
- `PUT /api/v1/form-bindings/{id}`
- `DELETE /api/v1/form-bindings/{id}`
- `POST /api/v1/datasources`
- `GET /api/v1/datasources`
- `GET /api/v1/datasources/{id}`
- `PUT /api/v1/datasources/{id}`
- `DELETE /api/v1/datasources/{id}`
- `POST /api/v1/datasources/{id}/test`
- `GET /api/v1/datasources/{id}/test-logs`
- `GET /api/v1/ops/summary`
- `GET /api/v1/ops/capabilities`
- `GET /api/v1/ops/process-instances?page=1&pageSize=10&keyword={keyword}&status={status}`
- `GET /api/v1/ops/process-instances/{instanceId}`
- `GET /api/v1/ops/process-instances/{instanceId}/trace`
- `POST /api/v1/ops/process-instances/{instanceId}/suspend`
- `POST /api/v1/ops/process-instances/{instanceId}/activate`
- `POST /api/v1/ops/process-instances/{instanceId}/terminate`
- `GET /api/v1/ops/failed-jobs`
- `GET /api/v1/ops/failed-jobs/{jobId}`
- `POST /api/v1/ops/failed-jobs/{jobId}/retry`
- `POST /api/v1/ops/failed-jobs/{jobId}/delete`
- `GET /api/v1/ops/dead-letter-jobs`
- `GET /api/v1/ops/dead-letter-jobs/{jobId}`
- `POST /api/v1/ops/dead-letter-jobs/{jobId}/retry`
- `POST /api/v1/ops/dead-letter-jobs/{jobId}/delete`
- `GET /api/v1/connector-execution-logs`
- `GET /api/v1/connector-execution-logs/summary`
- `GET /api/v1/connector-execution-logs/{id}`
- `GET /api/v1/audit-logs`

## Headers

- `X-Tenant-Id`: defaults to `default` in development.
- `X-User-Id`: defaults to `anonymous`; console uses `admin`.
- `X-Request-Id`: optional; generated if absent.

The web console exposes Tenant, User, and optional Request fields in the header. Values are stored in browser local storage and sent on every API request.
