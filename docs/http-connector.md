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
- `headers`: JSON object string
- `body`: optional request body
- `timeoutMillis`: optional timeout, defaults to 5000
- `outputVariable`: variable name for the connector response

In the console designer, select a `bpmn:ServiceTask` to edit the delegate expression and the basic HTTP connector fields above. This covers the demo configuration path without requiring raw XML edits. The designer validates headers as a JSON object and requires `timeoutMillis` to be a positive integer before applying connector properties.

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

Audit details intentionally keep only connector type, status, status code, request ID, and elapsed time. URL, headers, request body, response body, and error payloads stay out of audit records to reduce secret leakage risk.

Query logs with:

```http
GET /api/v1/connector-execution-logs?connectorType=http&page=1&pageSize=30
```

Query the corresponding audit events with:

```http
GET /api/v1/audit-logs?action=CONNECTOR_EXECUTE&resourceType=CONNECTOR_EXECUTION&page=1&pageSize=20
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

- `examples/bpmn/http-connector-demo.bpmn20.xml`
- `examples/http/koravo.http`

The demo flow starts, executes the HTTP service task, stores the response in a process variable, then continues to a user task assigned to `${approver}`.

## Current Limits

- Only GET and POST are supported.
- OAuth, mTLS, retry policies, and advanced connector configuration UI are planned.
