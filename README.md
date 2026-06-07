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
- Vue 3.5
- TypeScript
- Vite 6
- Pinia
- Vue Router
- Axios
- Ant Design Vue
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
- `koravo-connector`: connector abstraction, HTTP connector, execution logs, connector audit, JDBC placeholder.
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

PostgreSQL defaults:

- database: `koravo`
- username: `koravo`
- password: `koravo`

MinIO API and console listen on `MINIO_API_PORT` and `MINIO_CONSOLE_PORT`; by default the console is available at `http://localhost:9001`.

## Run Backend

```bash
cd koravo-server
mvn -pl koravo-bootstrap -am spring-boot:run
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
http://localhost:5173
```

To run the packaged browser console with Docker Compose:

```bash
cd koravo-ui
npm run build
cd ..
docker compose up --build koravo-ui
```

The packaged UI uses the local `koravo-ui/dist` output, listens on `KORAVO_UI_PORT`, and proxies `/api/` to the Compose backend service.

## Console Demo Loop

1. Start PostgreSQL, Redis, and MinIO with Docker Compose.
2. Start backend. Liquibase creates `ko_*` platform tables. Flowable initializes its own tables.
3. Start frontend and open `http://localhost:5173`.
4. Use `Process Designer` to create or import `examples/bpmn/leave-approval.bpmn20.xml`, validate it, save the draft, and deploy it.
5. Create a form schema in `Forms`, bind it to `approveTask` with the deployed `processDefinitionId` in `Form Bindings`, then start a process with `processDefinitionKey = leaveApproval` and variables:

```json
{
  "applicant": "u001",
  "approver": "admin",
  "days": 2
}
```

6. Open `Tasks`, enter the task detail page, fill bound form fields or raw JSON form data, and complete the task with variables and an approval comment. The console validates variables and form data as JSON objects before submission.
7. Open `Process Instances` or `Ops` to inspect the process trace, current/completed nodes, variables, and timeline.
8. Open `Audit Logs` to review model, start, task, form, datasource, connector, and ops events.
9. Create, update, test, and inspect datasource test logs in `Data Sources`.

The same calls are available in [examples/http/koravo.http](examples/http/koravo.http).

## API Demo Loop

Deploy BPMN:

```bash
curl -X POST 'http://localhost:8080/api/v1/process-models/deploy?modelName=Leave%20Approval' \
  -H 'X-Tenant-Id: default' \
  -H 'X-User-Id: admin' \
  -F 'file=@examples/bpmn/leave-approval.bpmn20.xml'
```

Start process:

```bash
curl -X POST http://localhost:8080/api/v1/process-instances/start \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Id: default' \
  -H 'X-User-Id: admin' \
  -d '{"processDefinitionKey":"leaveApproval","businessKey":"LEAVE-001","variables":{"applicant":"u001","approver":"admin","days":2}}'
```

Complete a task:

```json
{
  "variables": {
    "approved": true
  },
  "formData": {
    "reason": "approved from Koravo demo"
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

The HTTP connector demo uses [examples/bpmn/http-connector-demo.bpmn20.xml](examples/bpmn/http-connector-demo.bpmn20.xml). Deploy it, start `httpConnectorDemo`, query the assigned `Review HTTP Result` task, complete it, then inspect the trace and connector logs. The service task stores the HTTP response in the `healthResult` process variable before moving to the review task.

```http
GET /api/v1/connector-execution-logs?connectorType=http&page=1&pageSize=20
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

The Flowable integration test class is present but disabled until a Docker-backed integration profile is added.

## FAQ

- Passwords are encrypted before storage and never returned by datasource APIs.
- Flowable tables are not modified by Koravo migrations.
- `X-Tenant-Id` defaults to `default` in development.
- `X-User-Id` defaults to `anonymous`; the console sends `admin`.
- The console header lets you switch Tenant, User, and optional Request ID; values persist in browser local storage and are sent as API headers.
- The first frontend bundle is large because Ant Design Vue and bpmn-js are both used by the console.

## License

Apache License 2.0. See [LICENSE](LICENSE).

## Roadmap

- Model Center richer property panels and version diff/merge UI.
- Task Center copy, transfer, delegate, and richer assignment features.
- Form Center advanced JSON Schema widgets, nested objects, arrays, and conditional forms.
- Data Hub external secret backends and query governance.
- Connector Hub registry UI, config templates, retry policies, OAuth, and mTLS.
- Ops Center dead-letter jobs, retries, migrations, and deeper operational search.
