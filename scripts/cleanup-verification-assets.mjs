#!/usr/bin/env node
import process from "node:process";

const baseUrl = stripTrailingSlash(process.env.KORAVO_BASE_URL ?? "http://localhost:8080/api/v1");
const tenantId = process.env.KORAVO_TENANT_ID ?? "default";
const password = process.env.KORAVO_PASSWORD ?? "Koravo@2026";

async function main() {
  const admin = await login("admin", "admin");
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

  const enablement = await api("/workflow-enablement/init", {
    method: "POST",
    token: admin.token,
  });

  console.log(JSON.stringify({
    baseUrl,
    tenantId,
    scannedModels: models.length,
    verificationModels: verificationModels.length,
    classified,
    archived,
    workflowReady: enablement.initialized,
    retainedProcessKey: enablement.processDefinitionKey,
    retainedFormSchemaId: enablement.formSchemaId,
  }, null, 2));
}

function isVerificationModel(model) {
  const key = String(model.modelKey ?? "");
  const name = String(model.modelName ?? "");
  return model.assetOrigin === "TEST_FIXTURE"
    || /^enterpriseApproval\d*$/i.test(key)
    || /^koravoProcess/i.test(key)
    || name.includes("越权访问验收");
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

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
