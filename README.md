# Koravo

Koravo is an open-source process and data orchestration platform based on Flowable.

Koravo is not an OA approval clone and is not a thin Flowable admin console. The current foundation keeps Flowable as the process execution kernel and adds platform boundaries for process models, BPMN design, task center, form schema and bindings, datasource governance, connectors, audit logs, and operations.

## Architecture

```text
koravo-ui
  -> /api/v1
koravo-bootstrap
  -> koravo-api controllers and filters
  -> koravo-model / koravo-task / koravo-form / koravo-datahub / koravo-ops
  -> koravo-engine ProcessFacade
  -> Flowable services
  -> PostgreSQL + Redis + MinIO
```

Controllers never use Flowable native services directly. `ProcessFacade` is the platform boundary for deployment, start, task query, completion, and instance inspection.

## Tech Stack

- Java 21
- Spring Boot 3.5.3
- Flowable 7.1.0
- Maven
- PostgreSQL 16
- Redis 7
- MinIO
- Liquibase
- Spring Data JPA
- Spring Security with development header authentication
- Springdoc OpenAPI
- JUnit 5
- TypeScript
- React 19
- Umi Max 4
- antd 6
- Ant Design Pro V6 and ProComponents
- React Query
- Biome
- utoopack
- bpmn-js modeler/viewer for process design and tracing

Spring Boot 4.x and Flowable 8.x are not used in this baseline because compatible open-source Flowable 8 Spring Boot starters were not available from Maven Central during implementation. See [ADR 0001](docs/adr/0001-tech-stack.md).

## Modules

- `koravo-common`: response contract, errors, exceptions, pagination, base entity, IDs, JSON/time helpers.
- `koravo-tenant`: `X-Tenant-Id` based tenant context with `default` fallback.
- `koravo-security`: development authentication from `X-User-Id` with `anonymous` fallback.
- `koravo-engine`: Flowable adapter and `ProcessFacade`.
- `koravo-model`: platform process model drafts, validation, lifecycle, BPMN import/export, and Flowable deployment API.
- `koravo-task`: pending/done/started task queries, runtime and historic task detail, completion, comments, form snapshots, and task audit views.
- `koravo-form`: form schema, form binding, and immutable form snapshot table boundary.
- `koravo-datahub`: JDBC datasource management, secret encryption, connection tests, test logs, update, and soft delete.
- `koravo-connector`: connector abstraction, HTTP connector, execution logs, connector audit, and JDBC extension boundary.
- `koravo-ops`: process instance inspection, trace, runtime actions, connector exception summaries, and audit log.
- `koravo-api`: request ID filter, health API, OpenAPI, exception handling, instance APIs.
- `koravo-bootstrap`: Spring Boot entrypoint, application config, Liquibase changelog.

## Documentation

- [Architecture](docs/architecture.md)
- [API design](docs/api-design.md)
- [Deployment guide](docs/deployment-guide.md)
- [Development guide](docs/development-guide.md)
- [Model center](docs/model-center.md)
- [Form binding](docs/form-binding.md)
- [Process tracing](docs/process-tracing.md)
- [Ops and audit](docs/ops-and-audit.md)
- [Audit](docs/audit.md)
- [Acceptance checklist](docs/acceptance.md)
- [Task center](docs/task-center.md)
- [HTTP connector](docs/http-connector.md)
- [Data source](docs/data-source.md)
- [Security notes](docs/security-notes.md)
- [Connector design](docs/connector-design.md)

## Package Sources

The repository includes:

- `.npmrc` using `https://registry.npmmirror.com` by default.
- `koravo-server/.mvn/settings-cn.xml` using Aliyun Maven public mirror.

If the domestic npm mirror is slow or fails, use the existing network proxy with official npm:

```bash
cd koravo-ui
npm install --registry=https://registry.npmjs.org --no-audit --no-fund
```

## Start Dependencies

```bash
cp .env.example .env
docker compose up -d postgres redis minio
```

If Docker Hub is slow or rate-limited, edit `.env` and point `POSTGRES_IMAGE`, `REDIS_IMAGE`, or `MINIO_IMAGE` to a domestic mirror or a pre-pulled local tag.

PostgreSQL defaults:

- database: `koravo`
- username: `koravo`
- password: `koravo`
- host port: `15432`

MinIO API and console listen on `MINIO_API_PORT` and `MINIO_CONSOLE_PORT`; by default the console is available at `http://localhost:9001`.

## Run Backend

```bash
cd koravo-server
mvn -pl koravo-bootstrap -am -DskipTests package
POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=15432 \
REDIS_HOST=127.0.0.1 REDIS_PORT=6379 \
java -jar koravo-bootstrap/target/koravo-bootstrap-0.1.0-SNAPSHOT.jar
```

OpenAPI UI:

```text
http://localhost:8080/swagger-ui.html
```

Health:

```bash
curl -H 'X-Tenant-Id: default' -H 'X-User-Id: admin' \
  http://localhost:8080/api/v1/health
```

## Run Frontend

```bash
cd koravo-ui
npm install
npm run dev
```

If `npm install` is slow on the domestic registry, use the proxy-backed command from the package sources section.

Open:

```text
http://localhost:8000
```

To run the packaged browser console with Docker Compose:

```bash
cd koravo-ui
npm run build
cd ..
docker compose up --build koravo-ui
```

The packaged UI uses the local `koravo-ui/dist` output, listens on `KORAVO_UI_PORT`, and proxies `/api/` to the Compose backend service.

## Console Workflow Loop

1. Start PostgreSQL, Redis, and MinIO with Docker Compose.
2. Start backend. Liquibase creates `ko_*` platform tables. Flowable initializes its own tables.
3. Start frontend and open `http://localhost:8000`.
   The Dashboard shows backend health, tenant/user/request context, pending and done task totals, started instances, and HTTP connector success/failure counts.
4. Use `Process Designer` to create or import `examples/bpmn/purchase-approval.bpmn20.xml`, validate it, save the draft, and deploy it. `Process Models` can also validate a stored draft and show structured errors or warnings before deployment.
5. Create a purchase request form schema in `Forms`, bind it to `managerApprovalTask` and `financeApprovalTask` with either the stored `processModelId` or deployed `processDefinitionId` in `Form Bindings`, then start a process with `processDefinitionKey = purchaseApproval` and variables:

```json
{
  "applicant": "u001",
  "department": "Engineering",
  "itemName": "Test environment server",
  "amount": 12000,
  "reason": "Workflow integration testing",
  "managerApprover": "admin",
  "financeApprover": "admin"
}
```

6. Open `Tasks`, switch to the assigned approver when needed, enter the task detail page, and complete the approval with the rendered business form or approval opinion controls.
7. From task detail, open the linked process instance, or open `Process Instances` / `Ops`, to inspect the process trace, current/completed nodes, variables, timeline, and saved form snapshots.
8. Open `Audit Logs` to review model, start, task, form, datasource, connector, and ops events.
9. Create, update, test, and inspect datasource test logs in `Data Sources`; pool settings are edited with structured fields.

The same calls are available in [examples/http/koravo.http](examples/http/koravo.http).

## API Workflow Loop

Deploy BPMN:

```bash
curl -X POST 'http://localhost:8080/api/v1/process-models/deploy?modelName=Leave%20Approval' \
  -H 'X-Tenant-Id: default' \
  -H 'X-User-Id: admin' \
  -F 'file=@examples/bpmn/purchase-approval.bpmn20.xml'
```

Start process:

```bash
curl -X POST http://localhost:8080/api/v1/process-instances/start \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Id: default' \
  -H 'X-User-Id: admin' \
  -d '{"processDefinitionKey":"purchaseApproval","businessKey":"PO-001","variables":{"applicant":"u001","department":"Engineering","itemName":"Test environment server","amount":12000,"reason":"Workflow integration testing","managerApprover":"admin","financeApprover":"admin"}}'
```

Complete a task:

```json
{
  "variables": {
    "approved": true
  },
  "formData": {
    "reason": "approved from Koravo"
  },
  "comment": "approved"
}
```

Then inspect:

- `GET /api/v1/tasks/my?page=1&pageSize=20`
- `GET /api/v1/tasks/done?page=1&pageSize=20`
- `GET /api/v1/tasks/{taskId}`
- `GET /api/v1/process-instances/{instanceId}`
- `GET /api/v1/ops/process-instances/{instanceId}/trace`
- `GET /api/v1/audit-logs?page=1&pageSize=20`
- `GET /api/v1/audit-logs?action=PROCESS_INSTANCE_START&resourceType=PROCESS_INSTANCE&page=1&pageSize=20`

The HTTP connector workflow uses [examples/bpmn/http-health-check.bpmn20.xml](examples/bpmn/http-health-check.bpmn20.xml). Deploy it, start `httpHealthCheck` with an `X-Request-Id`, query the assigned `Review HTTP Result` task, complete it, then inspect the instance detail, trace, connector logs, and connector audit. The service task stores the HTTP response in the `healthResult` process variable before moving to the review task.

```http
GET /api/v1/process-instances/{instanceId}
GET /api/v1/ops/process-instances/{instanceId}/trace
GET /api/v1/connector-execution-logs?connectorType=http&page=1&pageSize=20
GET /api/v1/connector-execution-logs?connectorType=http&requestId=health-check-request-1&page=1&pageSize=20
GET /api/v1/connector-execution-logs/summary?connectorType=http
GET /api/v1/audit-logs?action=CONNECTOR_EXECUTE&resourceType=CONNECTOR_EXECUTION&page=1&pageSize=20
GET /api/v1/audit-logs?action=CONNECTOR_EXECUTE&resourceType=CONNECTOR_EXECUTION&requestId=health-check-request-1&page=1&pageSize=20
```

## Tests

```bash
cd koravo-server
mvn test
```

Frontend:

```bash
cd koravo-ui
npm run build
```

The Flowable integration test class is isolated from the default test run.
Run reserved integration-profile tests explicitly with:

```bash
cd koravo-server
mvn -Pintegration-test -pl koravo-engine -am test
```

Default `mvn test` remains fast and does not require Docker-backed integration infrastructure.

## FAQ

- Passwords are encrypted before storage and never returned by datasource APIs.
- Flowable tables are not modified by Koravo migrations.
- `X-Tenant-Id` defaults to `default` in development.
- `X-User-Id` defaults to `anonymous`; the console sends `admin`.
- The console header lets you switch Tenant, User, and optional Request ID; values persist in browser local storage and are sent as API headers.
- The first frontend bundle is large because Ant Design Pro, ProComponents, antd, and bpmn-js are all used by the console.

## License

Apache License 2.0. See [LICENSE](LICENSE).

## Roadmap

- Model Center richer property panels and version diff/merge UI.
- Task Center copy, transfer, delegate, and richer assignment features.
- Form Center advanced field widgets, nested groups, arrays, and conditional forms.
- Data Hub external secret backends and query governance.
- Connector Hub registry UI, config templates, retry policies, OAuth, and mTLS.
- Ops Center dead-letter jobs, retries, migrations, and deeper operational search.
