# Audit

Koravo records tenant-scoped audit events for key platform mutations and operational actions. Audit records are stored in `ko_audit_log` and exposed through `/api/v1/audit-logs`.

## Query API

```http
GET /api/v1/audit-logs?page=1&pageSize=20
GET /api/v1/audit-logs?userId=admin&page=1&pageSize=20
GET /api/v1/audit-logs?action=TASK_COMPLETE&resourceType=TASK&page=1&pageSize=20
GET /api/v1/audit-logs?resourceType=TASK&resourceId=task-1&page=1&pageSize=20
GET /api/v1/audit-logs?requestId=req-1&page=1&pageSize=20
GET /api/v1/audit-logs?startTime=2026-06-07T00:00:00Z&endTime=2026-06-07T23:59:59Z&page=1&pageSize=20
```

All queries are scoped by the current `X-Tenant-Id`. The console `Audit Logs` page supports the same filters and can open a single event to inspect metadata and formatted redacted detail JSON.

## Event Coverage

Implemented audit actions include:

- process model create, import, update, deploy, disable, and archive
- process instance start, suspend, activate, and terminate
- task completion
- form schema create and update
- form binding create, update, and delete
- datasource create, update, delete, and test
- connector execution

Task detail and process instance detail responses include recent resource-scoped audit records so approvers and operators can inspect audit context without leaving the workflow.

## Redaction

Audit details are redacted before persistence and again when queried. Common `password`, `token`, and `secret` fields are replaced with masked values. Connector audit events intentionally store only execution metadata such as connector type, status, status code, request ID, and elapsed time; URL, headers, request body, response body, and error payloads stay in connector execution logs and are summarized with redaction.

## Related Docs

- [Ops and audit](ops-and-audit.md)
- [Security notes](security-notes.md)
- [HTTP connector](http-connector.md)
