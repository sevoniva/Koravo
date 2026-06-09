# Module Design

## common

Defines `ApiResponse`, `PageResult`, `ErrorCode`, exception classes, `BaseEntity`, `IdGenerator`, JSON helpers, and request context.

## tenant

Loads the active platform tenant into `TenantContextHolder`; the web console also sends `X-Tenant-Id` so gateway-integrated deployments can keep the same request contract.

## security

Loads the active platform member and responsibility into `UserContextHolder` and Spring Security context. The web console sends `X-User-Id` and `X-User-Role` as request context, but users do not switch identity from page headers.

## engine

Owns Flowable integration. `ProcessFacade` supports BPMN deployment, process start, my task query, task completion, instance detail, and instance list. No controller depends on Flowable native services.

## model

Stores platform model metadata in `ko_process_model`. Deployment is currently BPMN XML upload through multipart API.

## task

Provides my pending tasks and task completion. It currently queries Flowable through `ProcessFacade` and leaves platform task extensions for later releases.

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
