# Acceptance Checklist

This checklist maps the v0.2/v0.3 consolidation target to concrete Koravo verification evidence.

## Build Gates

Run these before cutting a feature branch or pull request:

```bash
cd koravo-ui
npm run lint
npm exec --package @ant-design/cli -- antd lint ./src --format json --lang zh
npm run build
```

```bash
cd koravo-server
mvn -pl koravo-bootstrap -am test
```

```bash
node --check scripts/verify-collaborative-approval.mjs
node --check scripts/verify-enterprise-approval.mjs
node --check scripts/cleanup-verification-assets.mjs
node --check scripts/reset-trial-data.mjs
git diff --check
```

Optional integration-profile check:

```bash
cd koravo-server
mvn -Pintegration-test -pl koravo-engine -am test
```

Large approval workflow check:

```bash
cd koravo-server
mvn -pl koravo-engine test -Dtest=FlowableProcessFacadeIntegrationTest
```

This verification deploys and starts an enterprise approval process with 34 approval tasks, 10 departments, 20 approval roles, 4 embedded subprocess sections, and pooled approval nodes where one claimant can approve for the node. It then completes every task through the Koravo facade, checks the instance is completed, checks the trace contains every completed user task and subprocess, and checks there are no failed or dead-letter jobs.

The same BPMN file is available for manual console upload at `examples/bpmn/enterprise-approval-30-node.bpmn20.xml`. The model service test uploads that file through the user-facing deploy path and verifies platform validation, deployment metadata, model persistence, and audit recording.

Runtime approval workflow check:

```bash
node scripts/verify-collaborative-approval.mjs
node scripts/verify-enterprise-approval.mjs
```

The collaborative check uses the running backend API. It initializes the default workflow assets, verifies the core organization members and permission-denied audit logging, starts `collaborativeApproval` as applicant, completes the countersign tasks as manager and finance, then checks trusted applicant data, form snapshots, process trace, completed tasks, audit records, failed jobs, and dead-letter jobs.

The enterprise check logs in as admin, creates or updates 20 approver accounts across 10 departments, deploys the enterprise BPMN through `/api/v1/process-models/deploy` with `assetOrigin=TEST_FIXTURE`, starts `enterpriseApproval30` as applicant, completes all 34 tasks through assigned and candidate task APIs, then checks process trace, failed jobs, and dead-letter jobs.

After verification runs, reset the trial surface:

```bash
node scripts/reset-trial-data.mjs
```

The reset script classifies historical verification models as `TEST_FIXTURE`, archives them, reinitializes the default collaborative workflow assets, and checks the default product lists. It also keeps a small seed workload for verification: one running request for pending-task checks and one completed request for done-task, audit, and trace checks. Product task and ops lists hide verification business keys such as `EA-*`, `REQ-E2E-*`, `TRIAL-SEED-*`, `COLLAB-VERIFY-*`, `COLLABORATIVE-APPROVAL-*`, and `UI-CONTEXT-*`; verification scripts pass `includeNonProduction=true` when they need to inspect their own runtime records.

Useful environment overrides:

```bash
KORAVO_BASE_URL=http://localhost:8080/api/v1 \
KORAVO_TENANT_ID=default \
KORAVO_PASSWORD='Koravo@2026' \
node scripts/verify-enterprise-approval.mjs
```

## Console Workflow Check

The console workflow check is:

1. Start dependencies with `docker compose up -d postgres redis minio`.
2. Start `koravo-bootstrap`.
3. Start `koravo-ui`.
4. Log in as `admin`, open `系统设置`, and check workflow readiness.
5. Use `流程模型` or `流程设计` to validate and deploy the collaborative approval process.
6. Create or update the business request form in `表单管理`.
7. Bind the launch form and `jointApprovalTask` in `表单绑定`.
8. Log in as `applicant`, open `发起流程`, and start `collaborativeApproval` by selecting approvers directly or by approval role.
9. Open `我的申请` to confirm the applicant can see the flow diagram, current node, handlers, and status.
10. Log in as each approver, complete countersign tasks from `我的待办` with form data and comments.
11. Inspect task detail, instance detail, business data, form snapshots, trace, and audit logs. Operators can use `运维中心` for failed jobs, dead-letter jobs, and runtime actions.
12. Use `数据源管理` to create, update, test, and inspect datasource test logs.

## Connector Operations Check

Use a connector-enabled workflow model from the designer or a local fixture:

1. Deploy the workflow through `流程模型` after release check passes.
2. Start the workflow with an `X-Request-Id`.
3. Complete the user task after the connector step.
4. Inspect process trace, connector execution logs, connector execution detail, and `CONNECTOR_EXECUTE` audit events filtered by the same request ID.
5. Retry a failed connector execution from `集成动作`, then verify the retry log and `CONNECTOR_RETRY` audit event share the same operational context.

## Security And Boundary Checks

- Controllers call application services and platform facades, not Flowable native services.
- APIs use `/api/v1`.
- Java packages use `io.koravo`.
- Datasource responses do not expose raw password or password cipher.
- Connector audit records keep minimal metadata; request and response summaries are redacted.
- Arbitrary SQL execution is not exposed.
- Default tests run without Docker-backed integration services.

## Current Known Limits

- Fine-grained production RBAC, external secret backends, connector OAuth/mTLS/retry policies, and process migration APIs remain roadmap items.
- The default frontend bundle is large because Ant Design Pro, ProComponents, antd, and bpmn-js are all used by the console.
