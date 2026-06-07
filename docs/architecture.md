# Architecture

Koravo uses Flowable as the process execution kernel because Flowable already provides BPMN parsing, deployment, runtime execution, task service, history, and tenant-aware process definitions. Koravo adds the product layer around it: platform metadata, task center, form schema, datasource governance, connector abstractions, audit logs, and operations APIs.

Koravo does not fork Flowable. Forking would create a long-term maintenance burden and make upgrades harder. The project integrates Flowable through official Spring Boot starters and keeps all engine access inside `koravo-engine`.

The backend is a modular monolith. That keeps v0.1 simple to run and test while preserving future extraction boundaries. Modules communicate through Java services and DTOs instead of remote calls.

## Boundaries

- Platform controllers call application services.
- Application services call `ProcessFacade` for process operations.
- Only `koravo-engine` depends on Flowable native services.
- Flowable runtime data stays in Flowable tables.
- Business master data should live in business systems or datasource integrations.
- Process variables should contain small values and references, not large business JSON documents.

## Runtime Flow

```text
HTTP /api/v1
  -> RequestIdFilter, TenantFilter, DevAuthFilter
  -> Controller
  -> Application service
  -> ProcessFacade or Repository
  -> Flowable / PostgreSQL
```
