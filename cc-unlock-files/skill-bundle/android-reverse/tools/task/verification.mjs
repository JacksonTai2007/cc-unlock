import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { nowIso, taskFile, writeJsonFile } from "./common.mjs";

const allowedRunners = new Set(["node", "python"]);
const outputAssertionTypes = new Set([
  "stdout-equals",
  "stdout-includes",
  "stdout-json-equals"
]);

function cleanText(value) {
  return String(value ?? "").trim();
}

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function pathInsideDir(targetPath, dirPath) {
  const rel = path.relative(path.resolve(dirPath), path.resolve(targetPath));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function getValueByPath(target, valuePath) {
  return cleanText(valuePath)
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current == null ? undefined : current[key]), target);
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function verificationEnvironment() {
  const env = {};
  for (const key of [
    "PATH", "Path", "PATHEXT", "SystemRoot", "WINDIR", "TEMP", "TMP",
    "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "PYTHONIOENCODING"
  ]) {
    if (process.env[key] != null) env[key] = process.env[key];
  }
  env.NO_COLOR = "1";
  return env;
}

function evaluateAssertion(assertion, stdout, stderr) {
  const type = cleanText(assertion?.type).toLowerCase();
  let passed = false;
  let evidence = "";

  if (type === "stdout-equals") {
    const expected = String(assertion.value ?? "");
    passed = stdout.trim() === expected.trim();
    evidence = `expected exact stdout ${JSON.stringify(expected)}`;
  } else if (type === "stdout-includes") {
    const expected = String(assertion.value ?? "");
    passed = expected.length > 0 && stdout.includes(expected);
    evidence = `expected stdout to include ${JSON.stringify(expected)}`;
  } else if (type === "stdout-json-equals") {
    try {
      const parsed = JSON.parse(stdout);
      const actual = getValueByPath(parsed, assertion.path);
      passed = valuesEqual(actual, assertion.value);
      evidence = `stdout JSON ${cleanText(assertion.path) || "<root>"}=${JSON.stringify(actual)}`;
    } catch (error) {
      evidence = `stdout is not valid JSON: ${error.message}`;
    }
  } else if (type === "stderr-empty") {
    passed = stderr.trim().length === 0;
    evidence = passed ? "stderr is empty" : "stderr is not empty";
  } else {
    evidence = `unsupported assertion type: ${type || "<empty>"}`;
  }

  return { type, passed, evidence };
}

function validateCase(taskDir, item, index) {
  const errors = [];
  const id = cleanText(item?.id) || `case-${index + 1}`;
  const runner = cleanText(item?.runner).toLowerCase();
  const role = cleanText(item?.role).toLowerCase() || "generic";
  const entrypoint = cleanText(item?.entrypoint);
  const args = Array.isArray(item?.args) ? item.args : [];
  const assertions = Array.isArray(item?.assertions) ? item.assertions : [];

  if (!allowedRunners.has(runner)) {
    errors.push(`${id}: runner must be node or python`);
  }
  if (!entrypoint) {
    errors.push(`${id}: entrypoint is required`);
  }
  if (args.some((arg) => typeof arg !== "string")) {
    errors.push(`${id}: every arg must be a string`);
  }
  if (!assertions.some((assertion) => outputAssertionTypes.has(cleanText(assertion?.type).toLowerCase()))) {
    errors.push(`${id}: at least one discriminating stdout assertion is required`);
  }

  const unresolvedPath = path.resolve(taskDir, entrypoint || ".");
  let resolvedPath = unresolvedPath;
  if (entrypoint && fs.existsSync(unresolvedPath)) {
    resolvedPath = fs.realpathSync(unresolvedPath);
  }
  const realTaskDir = fs.realpathSync(taskDir);
  if (!pathInsideDir(resolvedPath, realTaskDir)) {
    errors.push(`${id}: entrypoint must stay inside the task directory`);
  } else if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    errors.push(`${id}: entrypoint does not exist or is not a file: ${entrypoint}`);
  }
  if (runner === "python" && entrypoint && !entrypoint.toLowerCase().endsWith(".py")) {
    errors.push(`${id}: python runner requires a .py entrypoint`);
  }
  if (runner === "node" && entrypoint && !/\.(?:[cm]?js)$/i.test(entrypoint)) {
    errors.push(`${id}: node runner requires a .js/.mjs/.cjs entrypoint`);
  }

  return {
    errors,
    value: {
      id,
      role,
      runner,
      entrypoint,
      entrypointPath: resolvedPath,
      args,
      assertions,
      timeoutMs: Math.min(Math.max(Number(item?.timeoutMs) || 30000, 1000), 120000)
    }
  };
}

export function readVerificationSpec(taskDir) {
  const specPath = taskFile(taskDir, "run/verification.spec.json");
  if (!fs.existsSync(specPath)) {
    return { ok: false, errors: ["missing run/verification.spec.json"], specPath, spec: null, cases: [] };
  }

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  } catch (error) {
    return { ok: false, errors: [`verification spec is invalid JSON: ${error.message}`], specPath, spec: null, cases: [] };
  }

  const rawCases = Array.isArray(spec?.cases) ? spec.cases : [];
  const errors = [];
  const cases = rawCases.map((item, index) => {
    const normalized = validateCase(taskDir, item, index);
    errors.push(...normalized.errors);
    return normalized.value;
  });
  const ids = cases.map((item) => item.id);
  if (cases.length === 0) {
    errors.push("verification spec requires at least one case");
  }
  if (new Set(ids).size !== ids.length) {
    errors.push("verification case ids must be unique");
  }

  return {
    ok: errors.length === 0,
    errors,
    specPath,
    spec,
    specSha256: sha256File(specPath),
    cases
  };
}

export function runVerification(taskDir) {
  const parsed = readVerificationSpec(taskDir);
  const executedAt = nowIso();
  const result = {
    schemaVersion: 1,
    ok: false,
    executedAt,
    specSha256: parsed.specSha256 || "",
    errors: parsed.errors.slice(),
    cases: []
  };

  if (parsed.ok) {
    for (const item of parsed.cases) {
      const command = item.runner === "node" ? process.execPath : "python";
      const run = spawnSync(command, [item.entrypointPath, ...item.args], {
        cwd: taskDir,
        encoding: "utf8",
        timeout: item.timeoutMs,
        maxBuffer: 1024 * 1024,
        shell: false,
        env: verificationEnvironment()
      });
      const stdout = String(run.stdout || "");
      const stderr = String(run.stderr || "");
      const assertionResults = item.assertions.map((assertion) => evaluateAssertion(assertion, stdout, stderr));
      const caseErrors = [];
      if (run.error) {
        caseErrors.push(run.error.message);
      }
      if (run.status !== 0) {
        caseErrors.push(`process exited with code ${run.status}`);
      }
      if (assertionResults.some((assertion) => !assertion.passed)) {
        caseErrors.push("one or more output assertions failed");
      }
      result.cases.push({
        id: item.id,
        role: item.role,
        runner: item.runner,
        entrypoint: item.entrypoint,
        entrypointSha256: sha256File(item.entrypointPath),
        args: item.args,
        exitCode: run.status,
        ok: caseErrors.length === 0,
        errors: caseErrors,
        assertions: assertionResults,
        stdout: stdout.slice(0, 16384),
        stderr: stderr.slice(0, 16384)
      });
    }
    result.ok = result.cases.length === parsed.cases.length && result.cases.every((item) => item.ok);
  }

  writeJsonFile(taskFile(taskDir, "run/verification-result.json"), result);
  return result;
}

function taskHasTier(task, tier) {
  return cleanText(task?.deliverableTier).toUpperCase() === tier ||
    (task?.deliverables || []).some((item) => item?.required !== false && cleanText(item?.tier).toUpperCase() === tier);
}

export function evaluateVerificationEvidence(taskDir, task) {
  const errors = [];
  const warnings = [];
  const parsed = readVerificationSpec(taskDir);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors, warnings, spec: parsed.spec, result: null };
  }

  const resultPath = taskFile(taskDir, "run/verification-result.json");
  if (!fs.existsSync(resultPath)) {
    return { ok: false, errors: ["missing run/verification-result.json; run task-verify first"], warnings, spec: parsed.spec, result: null };
  }

  let result;
  try {
    result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  } catch (error) {
    return { ok: false, errors: [`verification result is invalid JSON: ${error.message}`], warnings, spec: parsed.spec, result: null };
  }

  if (result.specSha256 !== parsed.specSha256) {
    errors.push("verification result is stale because verification.spec.json changed");
  }
  if (result.ok !== true) {
    errors.push("verification result did not pass");
  }

  const resultById = new Map((result.cases || []).map((item) => [cleanText(item.id), item]));
  for (const item of parsed.cases) {
    const recorded = resultById.get(item.id);
    if (!recorded) {
      errors.push(`verification result is missing case ${item.id}`);
      continue;
    }
    if (recorded.entrypointSha256 !== sha256File(item.entrypointPath)) {
      errors.push(`verification result for ${item.id} is stale because ${item.entrypoint} changed`);
    }
    if (recorded.ok !== true) {
      errors.push(`verification case ${item.id} did not pass`);
    }
  }

  const localCases = parsed.cases.filter((item) => item.role === "local-reproduction");
  if (task?.deliveryRequirements?.localReproductionRequested === true && localCases.length === 0) {
    errors.push("local reproduction delivery requires a local-reproduction verification case");
  }
  if (task?.deliveryRequirements?.apiCallExampleRequired === true && !parsed.cases.some((item) => item.role === "api-call")) {
    errors.push("API delivery requires an api-call verification case");
  }
  if (taskHasTier(task, "T5")) {
    const invocationSignatures = new Set(localCases.map((item) => JSON.stringify(item.args)));
    const assertionSignatures = new Set(localCases.map((item) => JSON.stringify(item.assertions)));
    if (localCases.length < 2 || invocationSignatures.size < 2 || assertionSignatures.size < 2) {
      errors.push("T5 verification requires at least two distinct local input/output vectors");
    }
    for (const item of localCases) {
      if (!item.assertions.some((assertion) => ["stdout-equals", "stdout-json-equals"].includes(cleanText(assertion?.type).toLowerCase()))) {
        errors.push(`T5 verification case ${item.id} requires an exact stdout or stdout JSON assertion`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, spec: parsed.spec, result };
}
