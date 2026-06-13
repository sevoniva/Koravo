#!/usr/bin/env node
import process from "node:process";

const baseUrl = stripTrailingSlash(process.env.KORAVO_BASE_URL ?? "http://localhost:8080/api/v1");
const tenantId = process.env.KORAVO_TENANT_ID ?? "default";
const password = process.env.KORAVO_PASSWORD ?? "Koravo@2026";
const processKey = "collaborativeApproval";
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

  const applicant = await login("applicant", "applicant");
  const operator = await login("operator", "operator");
  const approvers = new Map();
  for (const userId of approverIds) {
    approvers.set(userId, await login(userId));
  }

  const workflow = await startableWorkflow(applicant);
  const businessKey = `COLLAB-VERIFY-${Date.now()}`;
  const formData = {
    applicant: "系统会按登录成员覆盖",
    department: "系统会按组织覆盖",
    subject: "协同审批验收",
    businessDescription: "验证通用业务申请可以流转给多个审批人并完成会签。",
    expectedResult: "全部审批人完成后流程结束。",
    amount: 12800,
    approvalUsers: approverIds,
    remark: "自动验收",
  };
  const instance = await startProcess(applicant, workflow, businessKey, formData);
  const startedTrace = await waitForTrace(applicant, instance.instanceId, "RUNNING");
  assertEquals(startedTrace.currentTasks.length, approverIds.length, "parallel task count");

  for (const [index, userId] of approverIds.entries()) {
    const session = approvers.get(userId);
    const task = await waitForTask(session, instance.instanceId, userId);
    await completeTask(session, task.taskId, index + 1);
  }

  const completedTrace = await waitForTrace(applicant, instance.instanceId, "COMPLETED");
  assertEquals(completedTrace.variables?.applicant, applicant.name, "trusted applicant");
  assertEquals(completedTrace.variables?.department, applicant.department, "trusted department");
  assertListEquals(completedTrace.variables?.approvalUsers, approverIds, "trusted approvers");

  const detail = await api(`/process-instances/${instance.instanceId}`, { token: applicant.token });
  const failedJobs = await jobsForInstance(operator, "/ops/failed-jobs", instance.instanceId);
  const deadLetterJobs = await jobsForInstance(operator, "/ops/dead-letter-jobs", instance.instanceId);
  const completedTasks = await Promise.all(
    approverIds.map((userId) => doneTaskFor(approvers.get(userId), instance.instanceId)),
  );

  assertEquals(completedTrace.currentTasks.length, 0, "remaining task count");
  assertEquals(detail.status, "COMPLETED", "instance status");
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
        applicant: completedTrace.variables.applicant,
        department: completedTrace.variables.department,
        approvers: approverIds,
        completedTasks: completedTasks.map((task) => task.taskId),
        failedJobs: failedJobs.length,
        deadLetterJobs: deadLetterJobs.length,
      },
      null,
      2,
    ),
  );
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
      query: { page: 1, pageSize: 100 },
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
  throw new Error(`Missing approval task for ${userId}`);
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
    query: { page: 1, pageSize: 100 },
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

async function api(pathname, options = {}) {
  const url = new URL(`${baseUrl}${pathname}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = { "X-Koravo-Tenant-Id": tenantId };
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
