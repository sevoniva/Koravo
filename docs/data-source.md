# Data Source

Koravo manages datasource metadata and connection testing without exposing arbitrary SQL execution.

## APIs

- `POST /api/v1/datasources`: create datasource
- `GET /api/v1/datasources`: list datasources
- `GET /api/v1/datasources/{id}`: get datasource detail
- `PUT /api/v1/datasources/{id}`: update datasource metadata and optionally rotate password
- `DELETE /api/v1/datasources/{id}`: soft delete datasource
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

When updating a datasource, an empty or missing `password` keeps the existing encrypted password. Supplying a non-empty `password` rotates the secret.

Datasource create/update/delete/test operations write audit events:

- `DATASOURCE_CREATE`
- `DATASOURCE_UPDATE`
- `DATASOURCE_DELETE`
- `DATASOURCE_TEST`

## Console

Use `/datasources` to create, edit, delete, inspect detail responses, run connection tests, and review recent test logs. Detail and list responses intentionally omit password fields.

## Current Limits

- JDBC Connector execution is intentionally not exposed as arbitrary SQL.
- External secret backends such as KMS or Vault are planned.
