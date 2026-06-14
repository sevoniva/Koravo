# Module Design

## common

Defines `ApiResponse`, `PageResult`, `ErrorCode`, exception classes, `BaseEntity`, `IdGenerator`, JSON helpers, and request context.

## tenant

Loads the active platform tenant into `TenantContextHolder`. The web console sends `X-Koravo-Tenant-Id` and defaults to `default` for local development.

## security

Loads the active platform member and responsibility into `UserContextHolder` and Spring Security context. Normal requests use `Authorization: Bearer <token>` from `/api/v1/auth/login`; the development platform-token fallback uses `X-Koravo-User-Id`, `X-Koravo-User-Role`, and `X-Koravo-Platform-Token`.

## engine

Owns Flowable integration. `ProcessFacade` supports BPMN deployment, process start, my task query, task completion, instance detail, and instance list. No controller depends on Flowable native services.

## model

Stores platform model metadata in `ko_process_model`. Deployment is currently BPMN XML upload through multipart API.

## task

Provides pending task lists, task detail, task completion, process context, flow trace, form snapshots, and processing records through the platform API.

## form

Provides schema creation and lookup. `ko_form_snapshot` exists so historical approval rendering can use snapshots instead of the latest schema.

## datahub

Stores JDBC datasource definitions, encrypts passwords through `SecretService`, hides passwords from responses, and tests JDBC connectivity with timeout.

## connector

Defines `Connector`, `ConnectorRequest`, `ConnectorResponse`, `ConnectorContext`, and `ConnectorRegistry`. HTTP connector supports GET/POST with URL policy. JDBC connector is a reserved boundary.

## ops

Provides process instance inspection and audit logging. Key actions write `ko_audit_log`.

## api

Provides cross-cutting web concerns: request ID, OpenAPI, health, global exceptions, and process instance API.

## bootstrap

Assembles all modules, application configuration, Liquibase changelog, and Spring Boot entrypoint.
