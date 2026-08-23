import path from "node:path";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  defaultJobsForGroup,
  getChecksForGroup,
  normalizeCheckGroup,
  supportedCheckGroups
} from "./check-manifest.mjs";
import { primeTaskSnapshotCache } from "./task-snapshot-lib.mjs";

const baseDir = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = argv.slice(2);
  let group = "all";
  let jobs = null;
  let profile = false;
  let listGroups = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--profile") {
      profile = true;
      continue;
    }
    if (arg === "--list-groups") {
      listGroups = true;
      continue;
    }
    if (arg.startsWith("--group=")) {
      group = arg.slice("--group=".length);
      continue;
    }
    if (arg === "--group" && args[index + 1]) {
      group = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--jobs=")) {
      jobs = Number.parseInt(arg.slice("--jobs=".length), 10);
      continue;
    }
    if (arg === "--jobs" && args[index + 1]) {
      jobs = Number.parseInt(args[index + 1], 10);
      index += 1;
    }
  }

  return { group, jobs, profile, listGroups };
}

function sanitizeJobs(jobs, group) {
  if (Number.isInteger(jobs) && jobs > 0) {
    return jobs;
  }

  const envJobs = Number.parseInt(process.env.WEB_REVERSE_QA_JOBS || "", 10);
  if (Number.isInteger(envJobs) && envJobs > 0) {
    return envJobs;
  }

  return defaultJobsForGroup(group);
}

function renderCapturedOutput(text) {
  const normalized = String(text || "").trim();
  return normalized ? `${normalized}\n` : "";
}

function printResult(result) {
  const header = `=== ${result.name} (${result.durationMs} ms, exit=${result.status}) ===\n`;
  const output = renderCapturedOutput(result.stdout);
  const errorOutput = renderCapturedOutput(result.stderr);

  if (result.status === 0) {
    process.stdout.write(header);
    if (output) process.stdout.write(output);
    if (errorOutput) process.stdout.write(errorOutput);
    return;
  }

  process.stderr.write(header);
  if (output) process.stderr.write(output);
  if (errorOutput) process.stderr.write(errorOutput);
}

function runCheck(definition) {
  const fullPath = path.join(baseDir, definition.name);
  const startedAt = performance.now();

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fullPath], {
      cwd: path.resolve(baseDir, "..", ".."),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        name: definition.name,
        durationMs: Math.round(performance.now() - startedAt),
        status: 1,
        stdout,
        stderr: `${stderr}${stderr ? "\n" : ""}${error.message}`
      });
    });

    child.on("close", (code) => {
      resolve({
        name: definition.name,
        durationMs: Math.round(performance.now() - startedAt),
        status: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}

async function runParallelChecks(definitions, jobs) {
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < definitions.length) {
      const currentIndex = cursor;
      cursor += 1;
      const result = await runCheck(definitions[currentIndex]);
      results.push(result);
      printResult(result);
    }
  }

  const workerCount = Math.min(Math.max(jobs, 1), definitions.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function printProfile(results) {
  const totalMs = results.reduce((sum, item) => sum + item.durationMs, 0);
  console.log(`check-all: total=${totalMs} ms`);
  console.log("check-all: slowest-checks");
  for (const item of [...results].sort((left, right) => right.durationMs - left.durationMs).slice(0, 10)) {
    console.log(`- ${item.name}: ${item.durationMs} ms (exit=${item.status})`);
  }
}

function printGroupCatalog() {
  for (const group of supportedCheckGroups) {
    const checks = getChecksForGroup(group);
    console.log(`${group}: ${checks.length} checks`);
  }
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.listGroups) {
    printGroupCatalog();
    return;
  }

  const normalizedGroup = normalizeCheckGroup(options.group);
  if (!normalizedGroup) {
    console.error(`check-all: unknown group "${options.group}". supported=${supportedCheckGroups.join(", ")}`);
    process.exit(1);
  }

  const checks = getChecksForGroup(normalizedGroup);
  const jobs = sanitizeJobs(options.jobs, normalizedGroup);

  if (["full", "deep", "all"].includes(normalizedGroup)) {
    primeTaskSnapshotCache();
  }

  const parallelChecks = checks
    .filter((item) => !item.exclusive)
    .slice()
    .sort((left, right) => right.estimatedMs - left.estimatedMs);
  const exclusiveChecks = checks.filter((item) => item.exclusive);

  const results = [];

  if (parallelChecks.length > 0) {
    results.push(...await runParallelChecks(parallelChecks, jobs));
  }

  for (const definition of exclusiveChecks) {
    const result = await runCheck(definition);
    results.push(result);
    printResult(result);
  }

  const failed = results.some((item) => item.status !== 0);

  if (options.profile) {
    printProfile(results);
  }

  if (failed) {
    process.exitCode = 1;
  } else {
    console.log(`check-all: OK group=${normalizedGroup} jobs=${jobs}`);
  }
}

await main();
