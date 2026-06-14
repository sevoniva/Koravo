#!/usr/bin/env node
import process from "node:process";

const baseUrl = stripTrailingSlash(process.env.KORAVO_BASE_URL ?? "http://localhost:8080/api/v1");
const tenantId = process.env.KORAVO_TENANT_ID ?? "default";
const password = process.env.KORAVO_PASSWORD ?? "Koravo@2026";
const processKey = "collaborativeApproval";
const activeSeedKey = process.env.KORAVO_TRIAL_ACTIVE_KEY ?? "TRIAL-SEED-ACTIVE";
const completedSeedKey = process.env.KORAVO_TRIAL_COMPLETED_KEY ?? "TRIAL-SEED-COMPLETED";
const approverIds = ["manager", "finance"];

async function main() {
  const admin = await login("admin", "admin");
  const applicant = await login("applicant", "applicant");
  const manager = await login("manager", "manager");
  const finance = await login("finance", "finance");
  const operator = await login("operator", "operator");

  const auditCleanup = await api("/ops/trial-data/audit-cleanup", {
    method: "POST",
    token: operator.token,
  });
  const governance = await cleanupVerificationAssets(admin);
  const enablement = await api("/workflow-enablement/init", {
    method: "POST",
    token: admin.token,
  });
  const workflow = await startableWorkflow(applicant);

  const activeSeed = await ensureActiveSeed(applicant, operator, workflow);
  const completedSeed = await ensureCompletedSeed(applicant, operator, workflow, { manager, finance });
  const trialSurface = await validateTrialSurface({ admin, applicant, operator, manager });

  console.log(JSON.stringify({
    baseUrl,
    tenantId,
    workflowReady: enablement.initialized,
    retainedProcessKey: enablement.processDefinitionKey,
    retainedFormSchemaId: enablement.formSchemaId,
    governance,
    auditCleanup,
    seeds: {
      active: activeSeed,
      completed: completedSeed,
    },
    trialSurface,
  }, null, 2));
}

async function cleanupVerificationAssets(admin) {
  const models = await api("/process-models", {
    token: admin.token,
    query: { includeNonProduction: true },
  });
  const verificationModels = models.filter(isVerificationModel);
  const classified = [];
  const archived = [];

  for (const model of verificationModels) {
    let current = model;
    if (current.assetOrigin !== "TEST_FIXTURE") {
      current = await api(`/process-models/${current.id}/asset-origin`, {
        method: "POST",
        token: admin.token,
        body: { assetOrigin: "TEST_FIXTURE" },
      });
      classified.push(current.modelKey);
    }
    if (current.status !== "ARCHIVED") {
      current = await api(`/process-models/${current.id}/archive`, {
        method: "POST",
        token: admin.token,
      });
      archived.push(current.modelKey);
    }
  }

  return {
    scannedModels: models.length,
    verificationModels: verificationModels.length,
    classified,
    archived,
  };
}

async function ensureActiveSeed(applicant, operator, workflow) {
  const existing = await instancesByBusinessKey(operator, activeSeedKey);
  const running = existing.find((instance) => instance.status === "RUNNING");
  if (running) {
    return seedSummary(running, "kept");
  }
  const completed = existing.find((instance) => instance.status === "COMPLETED");
  if (completed) {
    return seedSummary(completed, "already-completed");
  }
  const instance = await startProcess(applicant, workflow, activeSeedKey, {
    subject: "试用环境待办申请",
    businessDescription: "用于试用我的待办、审批上下文和流程追踪。",
    expectedResult: "保留为运行中状态，便于审批人体验办理。",
    approvalUsers: approverIds,
    remark: "开发重置脚本生成",
  });
  const trace = await waitForTrace(applicant, instance.instanceId, "RUNNING");
  return {
    action: "created",
    businessKey: activeSeedKey,
    instanceId: instance.instanceId,
    status: trace.status,
    currentTasks: trace.currentTasks?.length ?? 0,
  };
}

async function ensureCompletedSeed(applicant, operator, workflow, approvers) {
  const existing = await instancesByBusinessKey(operator, completedSeedKey);
  const completed = existing.find((instance) => instance.status === "COMPLETED");
  if (completed) {
    return seedSummary(completed, "kept");
  }
  const running = existing.find((instance) => instance.status === "RUNNING");
  if (running) {
    await completeSeedApprovals(running.instanceId, approvers);
    const trace = await waitForTrace(applicant, running.instanceId, "COMPLETED");
    return {
      action: "completed-existing",
      businessKey: completedSeedKey,
      instanceId: running.instanceId,
      status: trace.status,
      currentTasks: trace.currentTasks?.length ?? 0,
    };
  }
  const instance = await startProcess(applicant, workflow, completedSeedKey, {
    subject: "试用环境已办申请",
    businessDescription: "用于试用我的申请、已办任务、审计记录和完成态流程追踪。",
    expectedResult: "多人会签完成后进入完成态。",
    approvalUsers: approverIds,
    remark: "开发重置脚本生成",
  });
  await completeSeedApprovals(instance.instanceId, approvers);
  const trace = await waitForTrace(applicant, instance.instanceId, "COMPLETED");
  return {
    action: "created",
    businessKey: completedSeedKey,
    instanceId: instance.instanceId,
    status: trace.status,
    currentTasks: trace.currentTasks?.length ?? 0,
  };
}

async function completeSeedApprovals(instanceId, approvers) {
  for (const [index, userId] of approverIds.entries()) {
    const task = await waitForTask(approvers[userId], instanceId, userId);
    await completeTask(approvers[userId], task.taskId, index + 1);
  }
}

async function validateTrialSurface({ admin, applicant, operator, manager }) {
  const [visibleModels, visibleForms, startable, started, opsDefault, doneManager, auditLogs] = await Promise.all([
    api("/process-models", { token: admin.token }),
    api("/forms/schemas", { token: admin.token }),
    api("/workflow-enablement/startable-processes", { token: applicant.token }),
    api("/tasks/started", {
      token: applicant.token,
      query: { page: 1, pageSize: 100 },
    }),
    api("/ops/process-instances", {
      token: operator.token,
      query: { page: 1, pageSize: 100 },
    }),
    api("/tasks/done", {
      token: manager.token,
      query: { page: 1, pageSize: 100 },
    }),
    api("/audit-logs", {
      token: operator.token,
      query: { page: 1, pageSize: 100 },
    }),
  ]);

  const visibleRuntimeKeys = [
    ...(started.items ?? []).map((item) => item.businessKey),
    ...(opsDefault.items ?? []).map((item) => item.businessKey),
    ...(doneManager.items ?? []).map((item) => item.businessKey),
  ].filter(Boolean);
  const leakedRuntimeKeys = unique(visibleRuntimeKeys.filter(isVerificationBusinessKey));
  if (leakedRuntimeKeys.length) {
    throw new Error(`verification runtime records still visible by default: ${leakedRuntimeKeys.join(", ")}`);
  }

  const leakedModels = visibleModels.filter(isVerificationModel);
  if (leakedModels.length) {
    throw new Error(`verification process models still visible by default: ${leakedModels.map((item) => item.modelKey).join(", ")}`);
  }

  const leakedForms = visibleForms.filter((form) => !["SYSTEM_TEMPLATE", "USER_FLOW"].includes(form.assetOrigin));
  if (leakedForms.length) {
    throw new Error(`non-production forms still visible by default: ${leakedForms.map((item) => item.formKey).join(", ")}`);
  }

  if (!startable.some((item) => item.processDefinitionKey === processKey)) {
    throw new Error(`missing startable process ${processKey}`);
  }

  return {
    visibleModels: visibleModels.map((model) => `${model.modelKey}:${model.status}:${model.assetOrigin}`),
    visibleForms: visibleForms.map((form) => `${form.formKey}:${form.status}:${form.assetOrigin}`),
    startableProcesses: startable.map((item) => item.processDefinitionKey),
    defaultStartedTotal: started.total ?? 0,
    defaultOpsTotal: opsDefault.total ?? 0,
    managerDoneTotal: doneManager.total ?? 0,
    recentAuditTotal: auditLogs.total ?? 0,
    trialSeedKeys: visibleRuntimeKeys.filter((key) => key === activeSeedKey || key === completedSeedKey),
  };
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

async function instancesByBusinessKey(operator, businessKey) {
  const page = await api("/ops/process-instances", {
    token: operator.token,
    query: { page: 1, pageSize: 100, includeNonProduction: true, keyword: businessKey },
  });
  return (page.items ?? []).filter((item) => item.businessKey === businessKey);
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
        opinion: `试用审批 ${sequence} 已同意`,
        reviewComment: `试用审批 ${sequence} 已同意`,
      },
      comment: `试用审批 ${sequence} 已同意`,
    },
  });
}

function seedSummary(instance, action) {
  return {
    action,
    businessKey: instance.businessKey,
    instanceId: instance.instanceId,
    status: instance.status,
  };
}

function isVerificationModel(model) {
  const key = String(model.modelKey ?? "");
  const name = String(model.modelName ?? "");
  return model.assetOrigin === "TEST_FIXTURE"
    || model.assetOrigin === "SAMPLE"
    || /^enterpriseApproval\d*$/i.test(key)
    || /^koravoProcess/i.test(key)
    || name.includes("越权访问验收");
}

function isVerificationBusinessKey(value) {
  const key = String(value ?? "");
  return [
    /^PO-/,
    /^EA-/,
    /^TRACE-/,
    /^SECURITY-CHECK-/,
    /^COMPLETE-/,
    /^HTTP-/,
    /^REQ-CODEX-/,
    /^REQ-E2E-/,
    /^TRIAL-SEED-/,
    /^COLLABORATIVE-APPROVAL-/,
    /^COLLAB-VERIFY-/,
    /^COLLAB-SINGLE-/,
    /^UI-CONTEXT-/,
  ].some((pattern) => pattern.test(key));
}

function unique(values) {
  return [...new Set(values)];
}

async function login(userId, expectedRole) {
  const session = await api("/auth/login", {
    method: "POST",
    body: { tenantId, userId, password },
  });
  if (expectedRole && session.role !== expectedRole) {
    throw new Error(`${userId} role expected ${expectedRole}, got ${session.role}`);
  }
  return session;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
