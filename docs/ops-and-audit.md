# Ops and Audit

Koravo keeps operational process controls behind the platform API. Controllers call `ProcessOpsService`, and the service calls `ProcessFacade`; controllers do not access Flowable native services.

## Process Instance Inspection

Use these APIs to inspect process instances:

- `GET /api/v1/ops/process-instances?page=1&pageSize=20`
- `GET /api/v1/ops/process-instances/{instanceId}`
- `GET /api/v1/ops/process-instances/{instanceId}/trace`

The trace response includes instance metadata, current activity IDs, current tasks, BPMN XML, and the historic activity timeline. The console renders the BPMN XML with `bpmn-js` and marks completed and current activities.

## Process Instance Actions

The Ops API supports controlled runtime actions:

- `POST /api/v1/ops/process-instances/{instanceId}/suspend`
- `POST /api/v1/ops/process-instances/{instanceId}/activate`
- `POST /api/v1/ops/process-instances/{instanceId}/terminate`

Ops also exposes connector exception summaries:

- `GET /api/v1/connector-execution-logs/summary?connectorType=http`

The summary returns total, success, failed, and recent failed connector executions for the current tenant.
Each connector execution also writes a `CONNECTOR_EXECUTE` audit record with a minimal, redacted detail payload.

The console also reads the operational capability matrix:

- `GET /api/v1/ops/capabilities`

This endpoint separates available runtime controls from reserved boundaries. Instance inspection, tracing, and connector execution logs are marked `AVAILABLE`. Failed task inspection, dead-letter tasks, job retry, and process migration are marked `PLANNED` until the underlying Flowable operations are implemented and audited.

Terminate accepts an optional JSON body:

```json
{
  "reason": "Manual ops cleanup"
}
```

Each action is tenant-scoped. If the runtime instance is missing or outside the current tenant, Koravo returns `PROCESS_INSTANCE_NOT_FOUND`.

## Audit Events

Ops actions write audit records:

- `PROCESS_INSTANCE_START`
- `PROCESS_INSTANCE_SUSPEND`
- `PROCESS_INSTANCE_ACTIVATE`
- `PROCESS_INSTANCE_TERMINATE`
- `CONNECTOR_EXECUTE`

Query audit logs with:

```http
GET /api/v1/audit-logs?action=PROCESS_INSTANCE_SUSPEND&resourceType=PROCESS_INSTANCE&page=1&pageSize=20
```

Filter a specific audited resource with `resourceId`:

```http
GET /api/v1/audit-logs?resourceType=TASK&resourceId=task-1&page=1&pageSize=20
```

Trace one request across audited operations with `requestId`:

```http
GET /api/v1/audit-logs?requestId=req-1&page=1&pageSize=20
```

Process start audit events can be queried with:

```http
GET /api/v1/audit-logs?action=PROCESS_INSTANCE_START&resourceType=PROCESS_INSTANCE&page=1&pageSize=20
```

Process start audit details include the process definition key, Flowable process definition ID, business key, and runtime status. Process variables are intentionally excluded from audit details.

The application instance detail API, `GET /api/v1/process-instances/{instanceId}`, includes the latest process instance audit records so the console can show start and ops events next to the trace.

Connector audit events can be queried with:

```http
GET /api/v1/audit-logs?action=CONNECTOR_EXECUTE&resourceType=CONNECTOR_EXECUTION&page=1&pageSize=20
```

Time range filters use ISO-8601 instants:

```http
GET /api/v1/audit-logs?startTime=2026-06-07T00:00:00Z&endTime=2026-06-07T23:59:59Z&page=1&pageSize=20
```

All calls should include:

- `Authorization: Bearer <token>`
- `X-Koravo-Tenant-Id`
- optional `X-Request-Id`

The audit record stores tenant, user, request ID, client IP, action, resource type, resource ID, and structured details. Detail fields are redacted before persistence and again when queried so common `password`, `token`, and `secret` fields are not exposed.
The console `Audit Logs` page can open a single event to inspect metadata and formatted redacted details without copying raw payloads.

## Current Limits

- Failed jobs, dead-letter jobs, retry, and migration APIs are still reserved for the next Ops iteration and surfaced as `PLANNED` capabilities.
- Terminated instances are visible through historic process instance queries, but runtime-only actions can only target active runtime instances.
