#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "..");
const baseUrl = stripTrailingSlash(process.env.KORAVO_BASE_URL ?? "http://localhost:8080/api/v1");
const tenantId = process.env.KORAVO_TENANT_ID ?? "default";
const password = process.env.KORAVO_PASSWORD ?? "Koravo@2026";
const bpmnFile = process.env.KORAVO_BPMN_FILE
  ? path.resolve(process.env.KORAVO_BPMN_FILE)
  : path.join(repoRoot, "examples/bpmn/enterprise-approval-30-node.bpmn20.xml");

const processKey = "enterpriseApproval30";
const verificationRequestId = `EA-RUNTIME-${Date.now()}`;
const modelName = "企业级审批链路检查";
const departmentNumbers = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

async function main() {
  const admin = await login("admin", "admin");
  const members = await ensureApprovalMembers(admin);
  const deployment = await deployProcess(admin);
  const applicant = await login("applicant", "applicant");
  const operator = await login("operator", "operator");
  const sessions = new Map([
    ["admin", admin],
    ["applicant", applicant],
    ["operator", operator],
  ]);
  const definition = enterpriseDefinition();
  const businessKey = verificationRequestId;
  const instance = await startProcess(applicant, definition, businessKey);

  for (const [index, step] of definition.steps.entries()) {
    await completeStep(sessions, step, instance.instanceId, index + 1);
    if ((index + 1) % 5 === 0 || index + 1 === definition.steps.length) {
      console.log(`completed ${index + 1}/${definition.steps.length}: ${step.taskDefinitionKey}`);
    }
  }

  const trace = await api(`/process-instances/${instance.instanceId}/trace`, {
    token: applicant.token,
  });
  const failedJobs = await jobsForInstance(operator, "/ops/failed-jobs", instance.instanceId);
  const deadLetterJobs = await jobsForInstance(operator, "/ops/dead-letter-jobs", instance.instanceId);
  const completedUserTasks = trace.timeline.filter(
    (node) => node.activityType === "userTask" && node.status === "COMPLETED",
  );
  const completedSubProcesses = trace.timeline.filter(
    (node) => node.activityType === "subProcess" && node.status === "COMPLETED",
  );

  assertEquals(trace.status, "COMPLETED", "process status");
  assertEquals(trace.currentTasks.length, 0, "current task count");
  assertEquals(completedUserTasks.length, 34, "completed user task count");
  assertEquals(completedSubProcesses.length, 4, "completed subprocess count");
  assertEquals(failedJobs.length, 0, "failed job count");
  assertEquals(deadLetterJobs.length, 0, "dead-letter job count");

  console.log(
    JSON.stringify(
      {
        baseUrl,
        tenantId,
        members,
        processDefinitionId: deployment.processDefinitionId,
        instanceId: instance.instanceId,
        businessKey,
        status: trace.status,
        totalSteps: definition.steps.length,
        pooledSteps: definition.steps.filter((step) => step.pooled).length,
        departments: definition.departments.length,
        roles: definition.roles.length,
        completedUserTasks: completedUserTasks.length,
        completedSubProcesses: completedSubProcesses.length,
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
  assertEquals(session.role, expectedRole, `${userId} role`);
  return session;
}

async function ensureApprovalMembers(admin) {
  const currentMembers = await api("/organization/members", { token: admin.token });
  const byUserId = new Map(currentMembers.map((member) => [member.userId, member]));
  const created = [];
  const updated = [];
  const passwordReset = [];

  for (let roleIndex = 1; roleIndex <= 20; roleIndex += 1) {
    const userId = approverUser(roleIndex);
    const departmentIndex = Math.ceil(roleIndex / 2);
    const role = roleIndex % 2 === 0 ? "finance" : "manager";
    const payload = {
      userId,
      name: approvalMemberName(roleIndex),
      department: approvalDepartmentName(departmentIndex),
      role,
      status: "ACTIVE",
      password,
    };
    const existing = byUserId.get(userId);
    if (existing) {
      await api(`/organization/members/${existing.key}`, {
        method: "PUT",
        token: admin.token,
        body: { ...payload, password: "" },
      });
      await api(`/organization/members/${existing.key}/reset-password`, {
        method: "POST",
        token: admin.token,
        body: { password },
      });
      updated.push(userId);
      passwordReset.push(userId);
      continue;
    }
    await api("/organization/members", {
      method: "POST",
      token: admin.token,
      body: payload,
    });
    created.push(userId);
  }

  return { created, updated, passwordReset };
}

async function deployProcess(admin) {
  const bpmnXml = await readFile(bpmnFile, "utf8");
  const formData = new FormData();
  formData.append("file", new Blob([bpmnXml], { type: "application/xml" }), path.basename(bpmnFile));
  return api("/process-models/deploy", {
    method: "POST",
    token: admin.token,
    query: { modelName, assetOrigin: "TEST_FIXTURE" },
    formData,
  });
}

async function startProcess(applicant, definition, businessKey) {
  return api("/process-instances/start", {
    method: "POST",
    token: applicant.token,
    body: {
      processDefinitionKey: processKey,
      businessKey,
      variables: {
        subject: "企业级审批链路检查",
        businessDescription: "覆盖多部门、多角色、并行认领和连续审批的运行链路。",
        expectedResult: "全部审批节点正常完成，运维队列无失败任务。",
        departmentCount: definition.departments.length,
        roleCount: definition.roles.length,
        approvalNodeCount: definition.steps.length,
        ...definition.roleVariables,
      },
    },
  });
}

async function completeStep(sessions, step, instanceId, sequence) {
  const session = await sessionFor(sessions, step.approverUser, step.systemRole);
  const task = await waitForTask(() => currentTraceTask(sessions.get("operator"), step, instanceId), step);
  if (step.pooled) {
    await api(`/tasks/${task.taskId}/actions`, {
      method: "POST",
      token: session.token,
      body: { action: "CLAIM", comment: `${step.name}已认领` },
    });
  }
  await api(`/tasks/${task.taskId}/complete`, {
    method: "POST",
    token: session.token,
    body: {
      variables: { [`${step.taskDefinitionKey}Decision`]: "APPROVED" },
      formData: {
        decision: "APPROVED",
        opinion: `${step.name}已通过`,
        sequence,
      },
      comment: `${step.name}已通过`,
    },
  });
}

async function currentTraceTask(operator, step, instanceId) {
  const trace = await api(`/ops/process-instances/${instanceId}/trace`, {
    token: operator.token,
  });
  return findStepTask(trace.currentTasks, step, instanceId);
}

async function waitForTask(findTask, step) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const task = await findTask();
    if (task) {
      return task;
    }
    await sleep(100);
  }
  throw new Error(`Missing active task ${step.taskDefinitionKey}`);
}

function findStepTask(tasks, step, instanceId) {
  return tasks.find(
    (task) => task.processInstanceId === instanceId && task.taskDefinitionKey === step.taskDefinitionKey,
  );
}

async function sessionFor(sessions, userId, expectedRole) {
  const existing = sessions.get(userId);
  if (existing) {
    return existing;
  }
  const session = await login(userId, expectedRole);
  sessions.set(userId, session);
  return session;
}

async function jobsForInstance(operator, pathname, instanceId) {
  const pageSize = 200;
  const jobs = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await api(pathname, {
      token: operator.token,
      query: { page, pageSize },
    });
    jobs.push(...result.items.filter((job) => job.processInstanceId === instanceId));
    if (page * pageSize >= result.total || result.items.length === 0) {
      break;
    }
  }
  return jobs;
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
  } else if (options.formData) {
    body = options.formData;
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

function enterpriseDefinition() {
  const departments = [];
  const roles = [];
  const roleVariables = {};
  const steps = [];

  for (let roleIndex = 1; roleIndex <= 20; roleIndex += 1) {
    roles.push(roleName(roleIndex));
    roleVariables[`role${pad(roleIndex)}User`] = approverUser(roleIndex);
  }

  for (let departmentIndex = 1; departmentIndex <= 10; departmentIndex += 1) {
    const departmentName = approvalDepartmentName(departmentIndex);
    departments.push(departmentName);
    const roleA = departmentIndex * 2 - 1;
    const roleB = departmentIndex * 2;
    const inSubProcess = [3, 5, 7, 9].includes(departmentIndex);
    const taskCount = inSubProcess ? 4 : 3;
    for (let taskIndex = 1; taskIndex <= taskCount; taskIndex += 1) {
      const pooled = taskIndex === 2 || (inSubProcess && taskIndex === 4);
      const roleIndex = taskIndex % 2 === 0 ? roleB : roleA;
      steps.push({
        taskDefinitionKey: `dept${pad(departmentIndex)}_approval_${pad(taskIndex)}`,
        name: `${departmentName}审批${pad(taskIndex)}`,
        pooled,
        candidateGroup: pooled ? roleName(roleIndex) : null,
        approverUser: approverUser(roleIndex),
        systemRole: roleIndex % 2 === 0 ? "finance" : "manager",
      });
    }
  }

  return { departments, roles, roleVariables, steps };
}

function roleName(roleIndex) {
  return `role-${pad(roleIndex)}`;
}

function approverUser(roleIndex) {
  return `user-role-${pad(roleIndex)}`;
}

function approvalMemberName(roleIndex) {
  const departmentName = approvalDepartmentName(Math.ceil(roleIndex / 2));
  return roleIndex % 2 === 0 ? `${departmentName}复核专员` : `${departmentName}审批主管`;
}

function approvalDepartmentName(departmentIndex) {
  return `业务${departmentNumbers[departmentIndex - 1]}部`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function assertEquals(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
