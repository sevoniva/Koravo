# Data Source

Koravo manages datasource metadata and connection testing without exposing arbitrary SQL execution.

## APIs

- `POST /api/v1/datasources`: create datasource
- `GET /api/v1/datasources`: list datasources
- `GET /api/v1/datasources/{id}`: get datasource detail
- `POST /api/v1/datasources/{id}/test`: test connection
- `GET /api/v1/datasources/{id}/test-logs?page=1&pageSize=20`: list test logs

## Secret Handling

Datasource passwords are encrypted before storage through `SecretService`.

API responses do not return:

- plaintext password
- encrypted password cipher

Audit logs and test logs should not contain secrets.

## Test Logs

Connection tests write `ko_datasource_test_log` with:

- datasource ID
- success flag
- message
- elapsed milliseconds
- tenant/user audit fields

Datasource create/test operations write audit events:

- `DATASOURCE_CREATE`
- `DATASOURCE_TEST`

## Current Limits

- Datasource update/delete APIs are not implemented yet.
- JDBC Connector execution is intentionally not exposed as arbitrary SQL.
- External secret backends such as KMS or Vault are planned.
