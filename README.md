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
- Spring Security with platform session context
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
- `koravo-tenant`: platform tenant context with `default` fallback.
- `koravo-security`: platform user context for the active deployment session.
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
curl -H 'X-Tenant-Id: default' -H 'X-User-Id: admin' -H 'X-User-Role: admin' \
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
4. Use `Process Models` to run the release check for the collaborative approval process, or use `Process Designer` to adjust the BPMN and save the draft before deployment.
5. Create or update the business request form in `Forms`, bind the start form plus `jointApprovalTask` in `Form Bindings`, then start a process with `processDefinitionKey = collaborativeApproval` and variables:

```json
{
  "applicant": "业务申请专员",
  "department": "业务一部",
  "subject": "通用业务申请",
  "businessDescription": "说明申请事项、背景和需要审批的内容",
  "expectedResult": "所有审批人完成会签后流程结束",
  "amount": 12800,
  "approvalUsers": ["manager", "finance"]
}
```

6. Open `My Tasks`, enter the task detail page as each assigned handler, and complete every parallel approval task with the rendered business form and processing comment.
7. From task detail, open the linked process instance, or open `Process Instances` / `Ops`, to inspect the process trace, current/completed nodes, variables, timeline, and saved form snapshots.
8. Open `Audit Logs` to review model, start, task, form, datasource, connector, and ops events.
9. Create, update, test, and inspect datasource test logs in `Data Sources`; pool settings are edited with structured fields.

The same calls are available in [examples/http/koravo.http](examples/http/koravo.http).

## API Workflow Loop

Prepare the default collaborative approval model from the console, then run release check and deployment from `Process Models`. Direct BPMN import is still available for custom models:

```bash
curl -X POST 'http://localhost:8080/api/v1/process-models/deploy?modelName=Custom%20Workflow' \
  -H 'X-Tenant-Id: default' \
  -H 'X-User-Id: admin' \
  -H 'X-User-Role: admin' \
  -F 'file=@examples/bpmn/http-health-check.bpmn20.xml'
```

Start process:

```bash
curl -X POST http://localhost:8080/api/v1/process-instances/start \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Id: default' \
  -H 'X-User-Id: applicant' \
  -H 'X-User-Role: applicant' \
  -d '{"processDefinitionKey":"collaborativeApproval","businessKey":"REQ-001","variables":{"applicant":"业务申请专员","department":"业务一部","subject":"通用业务申请","businessDescription":"说明申请事项、背景和需要审批的内容","expectedResult":"所有审批人完成会签后流程结束","amount":12800,"approvalUsers":["manager","finance"]}}'
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
- `GET /api/v1/tasks/candidates?page=1&pageSize=20`
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
- The web console sends the current tenant, member, role, and request trace context on API calls.
- Organization members and responsibilities are synchronized into Organization Permissions, not changed by switching identity in page headers.
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
