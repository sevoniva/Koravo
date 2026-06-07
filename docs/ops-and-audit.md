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

Terminate accepts an optional JSON body:

```json
{
  "reason": "Manual ops cleanup"
}
```

Each action is tenant-scoped. If the runtime instance is missing or outside the current tenant, Koravo returns `PROCESS_INSTANCE_NOT_FOUND`.

## Audit Events

Ops actions write audit records:

- `PROCESS_INSTANCE_SUSPEND`
- `PROCESS_INSTANCE_ACTIVATE`
- `PROCESS_INSTANCE_TERMINATE`

Query audit logs with:

```http
GET /api/v1/audit-logs?action=PROCESS_INSTANCE_SUSPEND&resourceType=PROCESS_INSTANCE&page=1&pageSize=20
```

All calls should include:

- `X-Tenant-Id`
- `X-User-Id`
- optional `X-Request-Id`

The audit record stores tenant, user, request ID, client IP, action, resource type, resource ID, and JSON details.

## Current Limits

- Failed jobs, dead-letter jobs, retry, and migration APIs are still reserved for the next Ops iteration.
- Terminated instances are visible through historic process instance queries, but runtime-only actions can only target active runtime instances.
