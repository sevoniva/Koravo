# Acceptance Checklist

This checklist maps the v0.2/v0.3 consolidation target to concrete Koravo verification evidence.

## Build Gates

Run these before cutting a feature branch or pull request:

```bash
cd koravo-ui
npm run build
```

```bash
cd koravo-server
mvn -pl koravo-bootstrap -am test
```

```bash
docker compose config
git diff --check
```

Optional integration-profile check:

```bash
cd koravo-server
mvn -Pintegration-test -pl koravo-engine -am test
```

## Console Workflow Check

The console workflow check is:

1. Start dependencies with `docker compose up -d postgres redis minio`.
2. Start `koravo-bootstrap`.
3. Start `koravo-ui`.
4. Use `Process Designer` to create or import `examples/bpmn/purchase-approval.bpmn20.xml`, validate, save draft, and deploy.
5. Create a purchase request form schema in `Forms`.
6. Bind the form to `managerApprovalTask` and `financeApprovalTask` in `Form Bindings` by `processModelId` or `processDefinitionId`.
7. Start `purchaseApproval` from `Process Instances`.
8. Complete both approval tasks from `Tasks` or task detail with variables, form data, and comments.
9. Inspect `Process Instance` / `Ops` trace, current and completed activities, variables, task detail, form snapshots, and audit logs.
10. Use `Data Sources` to create, update, test, and inspect datasource test logs.

## HTTP Connector Workflow Check

Use `examples/bpmn/http-health-check.bpmn20.xml` and `examples/http/koravo.http`:

1. Deploy `httpHealthCheck`.
2. Start it with `X-Request-Id`.
3. Confirm the HTTP service task writes `healthResult`.
4. Complete the assigned review task.
5. Inspect process trace, connector execution logs, connector execution detail, and `CONNECTOR_EXECUTE` audit events filtered by the same request ID.

## Security And Boundary Checks

- Controllers call application services and platform facades, not Flowable native services.
- APIs use `/api/v1`.
- Java packages use `io.koravo`.
- Datasource responses do not expose raw password or password cipher.
- Connector audit records keep minimal metadata; request and response summaries are redacted.
- Arbitrary SQL execution is not exposed.
- Default tests run without Docker-backed integration services.

## Current Known Limits

- Fine-grained production RBAC, external secret backends, connector OAuth/mTLS/retry policies, dead-letter job operations, and process migration APIs remain roadmap items.
- The default frontend bundle is large because Ant Design Pro, ProComponents, antd, and bpmn-js are all used by the console.
