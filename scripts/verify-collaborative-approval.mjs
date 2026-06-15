#!/usr/bin/env node
import process from "node:process";

const baseUrl = stripTrailingSlash(process.env.KORAVO_BASE_URL ?? "http://localhost:8080/api/v1");
const tenantId = process.env.KORAVO_TENANT_ID ?? "default";
const password = process.env.KORAVO_PASSWORD ?? "Koravo@2026";
const processKey = "collaborativeApproval";
const verificationRequestId = `COLLAB-VERIFY-${Date.now()}`;
const approverIds = (process.env.KORAVO_APPROVERS ?? "manager,finance")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

async function main() {
  if (approverIds.length < 2) {
    throw new Error("KORAVO_APPROVERS must include at least two users");
  }

  const admin = await login("admin", "admin");
  await api("/workflow-enablement/init", { method: "POST", token: admin.token });
  const organizationMembers = await assertCoreOrganizationMembers(admin);

  const applicant = await login("applicant", "applicant");
  const operator = await login("operator", "operator");
  const accessDeniedAuditLogs = await assertAccessDeniedAudited(applicant, operator);
  const approvers = new Map();
  for (const userId of approverIds) {
    approvers.set(userId, await login(userId));
  }

  const workflow = await startableWorkflow(applicant);
  await assertSingleApproverRejected(applicant, workflow);
  const businessKey = verificationRequestId;
  const formData = {
    subject: "通用业务申请检查",
    businessDescription: "检查通用业务申请可以流转给多个审批人并完成会签。",
    expectedResult: "全部审批人完成后流程结束。",
    approvalUsers: approverIds,
    remark: "自动检查",
  };
  const instance = await startProcess(applicant, workflow, businessKey, formData);
  const startedTrace = await waitForTrace(applicant, instance.instanceId, "RUNNING");
  assertEquals(startedTrace.currentTasks.length, approverIds.length, "countersign task count");
  assertListEquals(
    startedTrace.currentTasks.map((task) => task.assignee).sort(),
    [...approverIds].sort(),
    "countersign task assignees",
  );
  if (!startedTrace.currentActivityIds?.includes("jointApprovalTask")) {
    throw new Error(`current activity expected jointApprovalTask, got ${JSON.stringify(startedTrace.currentActivityIds)}`);
  }

  for (const [index, userId] of approverIds.entries()) {
    const session = approvers.get(userId);
    const task = await waitForTask(session, instance.instanceId, userId);
    await completeTask(session, task.taskId, index + 1);
  }

  const completedTrace = await waitForTrace(applicant, instance.instanceId, "COMPLETED");
  assertEquals(completedTrace.variables?.applicant, applicant.name, "trusted applicant");
  assertEquals(completedTrace.variables?.department, applicant.department, "trusted department");
  assertEquals(completedTrace.variables?.position, roleLabel(applicant.role), "trusted position");
  assertListEquals(completedTrace.variables?.approvalUsers, approverIds, "trusted approvers");

  const detail = await api(`/process-instances/${instance.instanceId}`, { token: applicant.token });
  const formSnapshots = await api("/forms/snapshots", {
    token: applicant.token,
    query: { processInstanceId: instance.instanceId },
  });
  const failedJobs = await jobsForInstance(operator, "/ops/failed-jobs", instance.instanceId);
  const deadLetterJobs = await jobsForInstance(operator, "/ops/dead-letter-jobs", instance.instanceId);
  const completedTasks = await Promise.all(
    approverIds.map((userId) => doneTaskFor(approvers.get(userId), instance.instanceId)),
  );
  const startAuditLogs = await waitForAuditLogs(
    operator,
    {
      action: "PROCESS_INSTANCE_START",
      resourceType: "PROCESS_INSTANCE",
      resourceId: instance.instanceId,
      userId: applicant.userId,
    },
    "process start audit",
  );
  const taskAuditLogs = await Promise.all(
    completedTasks.map((task) =>
      waitForAuditLogs(
        operator,
        {
          action: "TASK_COMPLETE",
          resourceType: "TASK",
          resourceId: task.taskId,
          userId: task.assignee,
        },
        `task complete audit ${task.taskId}`,
      ),
    ),
  );

  assertEquals(completedTrace.currentTasks.length, 0, "remaining task count");
  assertEquals(detail.status, "COMPLETED", "instance status");
  assertFormSnapshots(formSnapshots, formData, applicant, approverIds, completedTasks);
  assertEquals(failedJobs.length, 0, "failed job count");
  assertEquals(deadLetterJobs.length, 0, "dead-letter job count");

  console.log(
    JSON.stringify(
      {
        baseUrl,
        tenantId,
        processDefinitionKey: workflow.processDefinitionKey,
        processDefinitionId: instance.processDefinitionId,
        instanceId: instance.instanceId,
        businessKey,
        status: completedTrace.status,
        organizationMembers,
        applicant: completedTrace.variables.applicant,
        department: completedTrace.variables.department,
        position: completedTrace.variables.position,
        approvers: approverIds,
        workflowMode: "countersign",
        formSnapshotCount: formSnapshots.length,
        completedTasks: completedTasks.map((task) => task.taskId),
        startAuditCount: startAuditLogs.length,
        taskAuditCount: taskAuditLogs.flat().length,
        accessDeniedAuditCount: accessDeniedAuditLogs.length,
        failedJobs: failedJobs.length,
        deadLetterJobs: deadLetterJobs.length,
      },
      null,
      2,
    ),
  );
}

async function assertCoreOrganizationMembers(session) {
  const members = await api("/organization/members", { token: session.token });
  const byUserId = new Map(members.map((member) => [member.userId, member]));
  const expectedMembers = [
    { userId: "admin", role: "admin" },
    { userId: "applicant", role: "applicant" },
    { userId: "manager", role: "manager" },
    { userId: "finance", role: "finance" },
    { userId: "operator", role: "operator" },
  ];
  const verified = [];

  for (const expected of expectedMembers) {
    const member = byUserId.get(expected.userId);
    if (!member) {
      throw new Error(`missing organization member ${expected.userId}`);
    }
    assertEquals(member.role, expected.role, `${expected.userId} role`);
    assertEquals(member.status, "ACTIVE", `${expected.userId} status`);
    if (member.passwordConfigured !== true) {
      throw new Error(`${expected.userId} password must be configured`);
    }
    if (!member.name || !member.department) {
      throw new Error(`${expected.userId} must have name and department`);
    }
    verified.push({
      userId: member.userId,
      role: member.role,
      department: member.department,
      status: member.status,
    });
  }

  for (const userId of approverIds) {
    const member = byUserId.get(userId);
    if (!member) {
      throw new Error(`missing configured approver ${userId}`);
    }
    if (member.status !== "ACTIVE") {
      throw new Error(`approver ${userId} must be active`);
    }
  }

  return verified;
}

function assertFormSnapshots(snapshots, formData, applicant, approverIds, completedTasks) {
  assertEquals(snapshots.length, approverIds.length + 1, "form snapshot count");
  const startSnapshot = snapshots.find((snapshot) => !snapshot.taskId);
  if (!startSnapshot) {
    throw new Error("missing start form snapshot");
  }
  const startData = parseSnapshotData(startSnapshot);
  assertEquals(startData.subject, formData.subject, "start snapshot subject");
  assertEquals(startData.applicant, applicant.name, "start snapshot applicant");
  assertEquals(startData.department, applicant.department, "start snapshot department");
  assertEquals(startData.position, roleLabel(applicant.role), "start snapshot position");
  assertListEquals(startData.approvalUsers, approverIds, "start snapshot approvers");

  const completedTaskIds = new Set(completedTasks.map((task) => task.taskId));
  const taskSnapshots = snapshots.filter((snapshot) => snapshot.taskId);
  assertEquals(taskSnapshots.length, approverIds.length, "approval snapshot count");
  for (const snapshot of taskSnapshots) {
    if (!completedTaskIds.has(snapshot.taskId)) {
      throw new Error(`unexpected approval snapshot task ${snapshot.taskId}`);
    }
    const data = parseSnapshotData(snapshot);
    assertEquals(data.decision, "APPROVED", `approval decision ${snapshot.taskId}`);
    if (data.approved !== true) {
      throw new Error(`approval snapshot ${snapshot.taskId} must keep approved=true`);
    }
  }
}

function roleLabel(role) {
  return {
    admin: "管理员",
    applicant: "发起人",
    manager: "审批人",
    finance: "复核人",
    operator: "运维审计人",
  }[role] || role || "-";
}

function parseSnapshotData(snapshot) {
  try {
    return JSON.parse(snapshot.dataJson || "{}");
  } catch (error) {
    throw new Error(`invalid snapshot data ${snapshot.id}: ${error.message}`);
  }
}

async function login(userId, expectedRole) {
  const session = await api("/auth/login", {
    method: "POST",
    body: { tenantId, userId, password },
  });
  if (expectedRole) {
    assertEquals(session.role, expectedRole, `${userId} role`);
  }
  return session;
}

async function startableWorkflow(session) {
  const workflows = await api("/workflow-enablement/startable-processes", {
    token: session.token,
  });
  const workflow = workflows.find((item) => item.processDefinitionKey === processKey);
  if (!workflow?.startFormSchema) {
    throw new Error(`Missing startable workflow ${processKey}`);
  }
  return workflow;
}

async function assertSingleApproverRejected(session, workflow) {
  const formData = {
    subject: "单审批人规则检查",
    businessDescription: "检查通用一对多主流程不能退化成单人审批。",
    expectedResult: "系统阻止单审批人发起。",
    approvalUsers: [approverIds[0]],
  };
  try {
    await startProcess(session, workflow, `COLLAB-SINGLE-${Date.now()}`, formData);
  } catch (error) {
    if (String(error.message || error).includes("至少选择两名审批人")) {
      return;
    }
    throw error;
  }
  throw new Error("single approver collaborative start should be rejected");
}

async function assertAccessDeniedAudited(applicant, operator) {
  const denied = await apiFailure("/process-models", {
    method: "POST",
    token: applicant.token,
    body: {
      modelKey: `forbiddenModel${Date.now()}`,
      modelName: "权限边界检查",
      description: "申请人不能维护流程模型",
    },
  });
  assertEquals(denied.status, 403, "forbidden model write status");
  if (denied.payload?.code !== "FORBIDDEN") {
    throw new Error(`expected FORBIDDEN code, got ${JSON.stringify(denied.payload)}`);
  }
  return waitForAuditLogs(
    operator,
    {
      action: "ACCESS_DENIED",
      resourceType: "API_ENDPOINT",
      resourceId: "POST /api/v1/process-models",
      userId: applicant.userId,
    },
    "access denied audit",
  );
}

async function startProcess(session, workflow, businessKey, formData) {
  return api("/process-instances/start", {
    method: "POST",
    token: session.token,
    body: {
      processDefinitionKey: workflow.processDefinitionKey,
      businessKey,
      variables: formData,
      formSchemaId: workflow.startFormSchema.id,
      formSchemaVersion: workflow.startFormSchema.version,
      formData,
    },
  });
}

async function waitForTrace(session, instanceId, expectedStatus) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const trace = await api(`/process-instances/${instanceId}/trace`, {
      token: session.token,
    });
    if (trace.status === expectedStatus) {
      return trace;
    }
    await sleep(150);
  }
  throw new Error(`Process ${instanceId} did not reach ${expectedStatus}`);
}

async function waitForTask(session, instanceId, userId) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const page = await api("/tasks/my", {
      token: session.token,
      query: { page: 1, pageSize: 100, includeNonProduction: true },
    });
    const task = page.items.find(
      (item) =>
        item.processInstanceId === instanceId &&
        item.taskDefinitionKey === "jointApprovalTask" &&
        item.assignee === userId,
    );
    if (task) {
      return task;
    }
    await sleep(150);
  }
  throw new Error(`Missing countersign task for ${userId}`);
}

async function completeTask(session, taskId, sequence) {
  return api(`/tasks/${taskId}/complete`, {
    method: "POST",
    token: session.token,
    body: {
      variables: { approved: true, decision: "APPROVED" },
      formData: {
        decision: "APPROVED",
        approved: true,
        opinion: `第 ${sequence} 个审批人已同意`,
        reviewComment: `第 ${sequence} 个审批人已同意`,
      },
      comment: `第 ${sequence} 个审批人已同意`,
    },
  });
}

async function doneTaskFor(session, instanceId) {
  const page = await api("/tasks/done", {
    token: session.token,
    query: { page: 1, pageSize: 100, includeNonProduction: true },
  });
  const task = page.items.find((item) => item.processInstanceId === instanceId);
  if (!task) {
    throw new Error(`Missing completed task for ${session.userId}`);
  }
  return task;
}

async function jobsForInstance(operator, pathname, instanceId) {
  const result = await api(pathname, {
    token: operator.token,
    query: { page: 1, pageSize: 200 },
  });
  return result.items.filter((job) => job.processInstanceId === instanceId);
}

async function waitForAuditLogs(session, query, label) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const result = await api("/audit-logs", {
      token: session.token,
      query: { page: 1, pageSize: 100, includeNonProduction: true, ...query },
    });
    const items = result.items ?? [];
    if (items.length > 0) {
      return items;
    }
    await sleep(150);
  }
  throw new Error(`Missing ${label}`);
}

async function api(pathname, options = {}) {
  const url = new URL(`${baseUrl}${pathname}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = { "X-Koravo-Tenant-Id": tenantId };
  headers["X-Request-Id"] = options.requestId || verificationRequestId;
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  let body;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok || payload?.success === false) {
    throw new Error(
      `${options.method ?? "GET"} ${url.pathname} failed: ${response.status} ${payload?.message ?? text}`,
    );
  }
  return payload?.data ?? payload;
}

async function apiFailure(pathname, options = {}) {
  const url = new URL(`${baseUrl}${pathname}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = { "X-Koravo-Tenant-Id": tenantId };
  headers["X-Request-Id"] = options.requestId || verificationRequestId;
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  let body;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (response.ok && payload?.success !== false) {
    throw new Error(`${options.method ?? "GET"} ${url.pathname} should fail`);
  }
  return { status: response.status, payload };
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function assertEquals(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

function assertListEquals(actual, expected, label) {
  if (!Array.isArray(actual) || actual.length !== expected.length) {
    throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  for (const [index, value] of expected.entries()) {
    if (actual[index] !== value) {
      throw new Error(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
