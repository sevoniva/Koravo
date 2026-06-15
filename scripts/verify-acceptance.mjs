#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

const verificationScripts = [
  "scripts/verify-collaborative-approval.mjs",
  "scripts/verify-enterprise-approval.mjs",
  "scripts/cleanup-verification-assets.mjs",
  "scripts/reset-verification-data.mjs",
  "scripts/verify-acceptance.mjs",
];

const validFlags = new Set(["--enterprise", "--reset", "--reset-only", "--syntax-only", "--help"]);

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    return;
  }

  await runSyntaxChecks();

  if (flags.syntaxOnly) {
    return;
  }

  if (flags.resetOnly) {
    await runPhase("verification data reset", ["scripts/reset-verification-data.mjs"]);
    return;
  }

  await runPhase("collaborative approval runtime", ["scripts/verify-collaborative-approval.mjs"]);

  if (flags.enterprise) {
    await runPhase("enterprise approval runtime", ["scripts/verify-enterprise-approval.mjs"]);
  }

  if (flags.reset) {
    await runPhase("verification data reset", ["scripts/reset-verification-data.mjs"]);
  }
}

function parseFlags(argv) {
  const unknown = argv.filter((arg) => !validFlags.has(arg));
  if (unknown.length > 0) {
    throw new Error(`Unknown flag: ${unknown.join(", ")}`);
  }

  return {
    help: argv.includes("--help"),
    syntaxOnly: argv.includes("--syntax-only"),
    resetOnly: argv.includes("--reset-only"),
    enterprise: argv.includes("--enterprise") || process.env.KORAVO_VERIFY_ENTERPRISE === "1",
    reset: argv.includes("--reset") || process.env.KORAVO_VERIFY_RESET === "1",
  };
}

async function runSyntaxChecks() {
  for (const script of verificationScripts) {
    await runPhase(`syntax ${script}`, ["--check", script]);
  }
}

async function runPhase(label, args) {
  console.log(`\n[acceptance] ${label}`);
  await spawnNode(args);
}

function spawnNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(signal ? `Command stopped by ${signal}` : `Command exited with code ${code}`));
    });
  });
}

function printHelp() {
  console.log(`Usage: node scripts/verify-acceptance.mjs [options]

Options:
  --syntax-only   Only check verification script syntax.
  --enterprise    Also run the 30-node enterprise approval runtime check.
  --reset         Reset local verification data after runtime checks.
  --reset-only    Only reset local verification data after syntax checks.
  --help          Show this help.

Environment:
  KORAVO_BASE_URL=http://localhost:8080/api/v1
  KORAVO_TENANT_ID=default
  KORAVO_PASSWORD=Koravo@2026
  KORAVO_APPROVERS=manager,finance
  KORAVO_VERIFY_ENTERPRISE=1
  KORAVO_VERIFY_RESET=1`);
}

main().catch((error) => {
  console.error(`\n[acceptance] ${error.message}`);
  process.exitCode = 1;
});
