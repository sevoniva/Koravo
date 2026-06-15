# HTTP Connector

Koravo includes a real HTTP connector that can be executed from Flowable service tasks through `KoravoConnectorDelegate`.

## Delegate Expression

Use this Spring delegate expression in BPMN service tasks:

```text
${koravoConnectorDelegate}
```

Configure it with Flowable field extensions:

- `connectorType`: `http`
- `url`: target URL
- `method`: `GET` or `POST`
- request headers: maintained as key/value rows in the console
- `body`: optional request body
- `timeoutMillis`: optional timeout, defaults to 5000
- `outputVariable`: variable name for the connector response

In the console designer, select a `bpmn:ServiceTask` and enable `HTTP 调用`. The designer writes the delegate expression and Flowable field extensions, and request headers are edited as rows instead of a raw map string. `timeoutMillis` must be a positive integer before applying connector properties.

The output variable contains:

```json
{
  "statusCode": 200,
  "headers": {},
  "body": "..."
}
```

## Execution Logs

Every delegate execution writes `ko_connector_execution_log` with:

- connector type
- method
- URL
- status
- HTTP status code
- elapsed time
- request ID
- redacted request summary
- redacted response summary
- error message when failed

When a process is started through `/api/v1/process-instances/start`, Koravo stores the current request ID as a lightweight process variable. `KoravoConnectorDelegate` uses it in connector execution logs so connector calls can be correlated with the original API request.

Each connector call also writes a platform audit event:

- action: `CONNECTOR_EXECUTE`
- resource type: `CONNECTOR_EXECUTION`
- resource ID: connector execution log ID

Retrying a failed connector execution writes a separate `CONNECTOR_RETRY` audit event. The retry audit points at the retry log and keeps the source log ID in the detail payload.

Audit details intentionally keep only connector type, status, status code, request ID, and elapsed time. URL, headers, request body, response body, and error payloads stay out of audit records to reduce secret leakage risk.

Query logs with:

```http
GET /api/v1/connector-execution-logs?connectorType=http&page=1&pageSize=30
```

The console `Ops` page lists connector executions, recent failures, and a per-execution detail modal with request ID, URL, status, elapsed time, redacted request summary, redacted response summary, and error message.

Filter a single request with:

```http
GET /api/v1/connector-execution-logs?connectorType=http&requestId=req-1&page=1&pageSize=20
```

Query the corresponding audit events with:

```http
GET /api/v1/audit-logs?action=CONNECTOR_EXECUTE&resourceType=CONNECTOR_EXECUTION&page=1&pageSize=20
GET /api/v1/audit-logs?action=CONNECTOR_RETRY&resourceType=CONNECTOR_EXECUTION&page=1&pageSize=20
```

## URL Access Policy

The default policy allows:

- `https://...`
- `http://localhost...`
- `http://127.0.0.1...`

It blocks obvious private or metadata networks such as:

- `10.0.0.0/8`
- `172.16.0.0/12`
- `192.168.0.0/16`
- `169.254.0.0/16`
- `100.64.0.0/10`
- IPv6 unique local and link-local ranges such as `fc00::/7` and `fe80::/10`

Production deployments should replace this with environment-specific allowlists and network egress controls.

## Example

Use:

- `examples/bpmn/http-health-check.bpmn20.xml`
- `examples/http/koravo.http`

The workflow starts, executes the HTTP service task, stores the response in a process variable, then continues to a user task assigned to `${approver}`.
After starting the workflow with `X-Request-Id`, use the instance detail or trace APIs to confirm `healthResult` exists in process variables, then filter connector execution logs and connector audit events by that same request ID.

## Current Limits

- Only GET and POST are supported.
- OAuth, mTLS, retry policies, and advanced connector configuration UI are planned.
