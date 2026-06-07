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

## Security Boundary

The default `UrlAccessPolicy` allows:

- `https://...`
- `http://localhost...`

It does not broadly allow private network access by default. Production deployments should replace this policy with allowlists and network controls.

## JDBC Connector

The JDBC connector is a placeholder in v0.1. Datasource configuration and connection testing are implemented in `koravo-datahub`; arbitrary SQL execution is deliberately not exposed.
