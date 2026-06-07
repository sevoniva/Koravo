# HTTP Connector

Koravo includes a real HTTP connector that can be executed from Flowable service tasks through `KoravoConnectorDelegate`.

## Delegate Class

Use this Flowable class in BPMN service tasks:

```text
io.koravo.connector.flowable.KoravoConnectorDelegate
```

Configure it with Flowable field extensions:

- `connectorType`: `http`
- `url`: target URL
- `method`: `GET` or `POST`
- `headers`: JSON object string
- `body`: optional request body
- `timeoutMillis`: optional timeout, defaults to 5000
- `outputVariable`: variable name for the connector response

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

Query logs with:

```http
GET /api/v1/connector-execution-logs?connectorType=http&page=1&pageSize=30
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

Production deployments should replace this with environment-specific allowlists and network egress controls.

## Example

Use:

- `examples/bpmn/http-connector-demo.bpmn20.xml`
- `examples/http/koravo.http`

The demo flow starts, executes the HTTP service task, stores the response in a process variable, then continues to a user task assigned to `${approver}`.

## Current Limits

- Only GET and POST are supported.
- OAuth, mTLS, retry policies, and connector configuration UI are planned.
