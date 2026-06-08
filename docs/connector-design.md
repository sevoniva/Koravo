# Connector Design

The connector layer is intentionally small in v0.1.

## Interfaces

- `Connector`: executable connector contract.
- `ConnectorContext`: tenant, user, and request identity.
- `ConnectorRequest`: method, URL, headers, body, timeout.
- `ConnectorResponse`: status code, headers, body.
- `ConnectorRegistry`: resolves connectors by type.

## HTTP Connector

The HTTP connector supports:

- GET
- POST
- JSON-compatible string body
- headers
- timeout
- status code, headers, and body response

Flowable service tasks can call it through Spring delegate expression `${koravoConnectorDelegate}`.
Configure the delegate with Flowable field extensions:

- `connectorType`: currently `http`.
- `url`: target URL.
- `method`: `GET` or `POST`.
- `headers`: JSON object string.
- `body`: optional request body.
- `timeoutMillis`: optional timeout, defaults to 5000.
- `outputVariable`: process variable name for `{ statusCode, headers, body }`.

See `examples/bpmn/http-health-check.bpmn20.xml`.

## Security Boundary

The default `UrlAccessPolicy` allows:

- `https://...`
- `http://localhost...`
- `http://127.0.0.1...`

It blocks obvious private/link-local metadata targets such as `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, and `169.254.0.0/16`. Production deployments should replace this policy with allowlists and network controls.

Every connector delegate execution writes a row to `ko_connector_execution_log` with redacted request and response summaries.

## JDBC Connector

The JDBC connector remains a planned extension boundary in v0.1. Datasource configuration and connection testing are implemented in `koravo-datahub`; arbitrary SQL execution is deliberately not exposed.
