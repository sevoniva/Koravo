# Data Model

Koravo platform tables are managed by Liquibase in `koravo-bootstrap/src/main/resources/db/changelog/db.changelog-master.yaml`.

## Platform Tables

- `ko_tenant`
- `ko_process_model`
- `ko_form_schema`
- `ko_form_snapshot`
- `ko_datasource`
- `ko_connector_config`
- `ko_audit_log`

Most platform tables include:

- `id`
- `tenant_id`
- `created_by`
- `created_at`
- `updated_by`
- `updated_at`
- `deleted`

`ko_audit_log` also includes `user_id`, `action`, `resource_type`, `resource_id`, `request_id`, `client_ip`, and `detail_json`.

## Flowable Tables

Koravo does not modify Flowable internal table structures. Flowable creates and updates its own tables through `flowable.database-schema-update=true`.

## Tenant Design

All platform rows include `tenant_id`. The development tenant filter reads `X-Tenant-Id`; missing values use `default`.

## Datasource Secrets

`ko_datasource.password_cipher` stores encrypted password text. API responses never include raw password or cipher text. v0.1 uses AES-GCM through `SecretService`; future releases can replace it with KMS or vault integration.
