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
- `POST /api/v1/process-models/deploy`
- `POST /api/v1/process-instances/start`
- `GET /api/v1/process-instances/{instanceId}`
- `GET /api/v1/tasks/my`
- `GET /api/v1/tasks/done`
- `GET /api/v1/tasks/started`
- `GET /api/v1/tasks/{taskId}`
- `POST /api/v1/tasks/{taskId}/complete`
- `POST /api/v1/forms/schemas`
- `GET /api/v1/forms/schemas/{id}`
- `POST /api/v1/datasources`
- `GET /api/v1/datasources`
- `GET /api/v1/datasources/{id}`
- `POST /api/v1/datasources/{id}/test`
- `GET /api/v1/ops/process-instances`
- `GET /api/v1/ops/process-instances/{instanceId}`
- `GET /api/v1/ops/process-instances/{instanceId}/trace`
- `POST /api/v1/ops/process-instances/{instanceId}/suspend`
- `POST /api/v1/ops/process-instances/{instanceId}/activate`
- `POST /api/v1/ops/process-instances/{instanceId}/terminate`
- `GET /api/v1/connector-execution-logs/summary`
- `GET /api/v1/audit-logs`

## Headers

- `X-Tenant-Id`: defaults to `default` in development.
- `X-User-Id`: defaults to `anonymous`; console uses `admin`.
- `X-Request-Id`: optional; generated if absent.

The web console exposes Tenant, User, and optional Request fields in the header. Values are stored in browser local storage and sent on every API request.
