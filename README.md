# Koravo

Koravo is an open-source process and data orchestration platform based on Flowable.

Koravo is not an OA approval clone and is not a thin Flowable admin console. The v0.1 foundation keeps Flowable as the process execution kernel and adds platform boundaries for process models, task center, form schema, datasource governance, connectors, audit logs, and operations.

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
- bpmn-js as a reserved modeler dependency

Spring Boot 4.x and Flowable 8.x are not used in this baseline because compatible open-source Flowable 8 Spring Boot starters were not available from Maven Central during implementation. See [ADR 0001](docs/adr/0001-tech-stack.md).

## Modules

- `koravo-common`: response contract, errors, exceptions, pagination, base entity, IDs, JSON/time helpers.
- `koravo-tenant`: `X-Tenant-Id` based tenant context with `default` fallback.
- `koravo-security`: development authentication from `X-User-Id` with `anonymous` fallback.
- `koravo-engine`: Flowable adapter and `ProcessFacade`.
- `koravo-model`: platform process model metadata and BPMN deployment API.
- `koravo-task`: current user's pending tasks and completion API.
- `koravo-form`: form schema and snapshot table boundary.
- `koravo-datahub`: JDBC datasource management, secret encryption, connection test.
- `koravo-connector`: connector abstraction, HTTP connector, JDBC placeholder.
- `koravo-ops`: process instance inspection and audit log.
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

MinIO console is available at `http://localhost:9001`.

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

## Minimal Closed Loop

1. Start PostgreSQL, Redis, and MinIO with Docker Compose.
2. Start backend. Liquibase creates `ko_*` platform tables. Flowable initializes its own tables.
3. Deploy `examples/bpmn/leave-approval.bpmn20.xml`.
4. Start a process with `processDefinitionKey = leaveApproval` and variables:

```json
{
  "applicant": "u001",
  "approver": "admin",
  "days": 2
}
```

5. Query `GET /api/v1/tasks/my` with `X-User-Id: admin`.
6. Complete the task with:

```json
{
  "variables": {
    "approved": true,
    "comment": "approved"
  }
}
```

7. Inspect the process instance with `GET /api/v1/process-instances/{instanceId}`.
8. Create and test a datasource with `/api/v1/datasources`.

The same calls are available in [examples/http/koravo.http](examples/http/koravo.http).

## API Examples

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
- The first frontend bundle is large because Ant Design Vue and bpmn-js are present in the v0.1 foundation.

## License

Apache License 2.0. See [LICENSE](LICENSE).

## Roadmap

- Model Center property panel and richer version comparison.
- Task Center historic task detail, copy, transfer, and delegate features.
- Form Center schema-driven rendering and binding management.
- Data Hub datasource secret backends and query governance.
- Connector Hub registry, config, and execution policies.
- Ops Center dead-letter jobs, migrations, and audit search.
