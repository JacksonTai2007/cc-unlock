import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { failWith } from "./common.mjs";
import { discoverRolloutTaskTargets } from "./rollout-targets-lib.mjs";
import { evaluateCloseoutGate, runFormalValidation } from "../task/validation.mjs";
import { resolveTaskDir, taskFile, getTasksRoot, workspaceRoot, skillRoot, samePath } from "../task/common.mjs";

function parseTargets() {
  const cliTargets = process.argv.slice(2).filter((item) => !item.startsWith("--"));
  const envTargets = String(process.env.WEB_REVERSE_EVIDENCE_TARGETS || "")
    .split(/[;\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set([...cliTargets, ...envTargets]));
}

// P2-1 修复：自动扫描当前 workspaceRoot/artifacts/tasks/ 下的已有任务目录。
// 当 workspaceRoot 与 skillRoot 不同时（即外部 workspace 场景），才启用扫描，
// 避免 SKILL 包自身 QA 时把 _TEMPLATE 等内部目录误判为待审任务。
// 扫描结果排除 _TEMPLATE 及缺少 task.json 的目录，与 rolloutTargets / explicitTargets 合并。
function defaultContractTargets() {
  if (samePath(workspaceRoot, skillRoot)) return [];
  const tasksRoot = getTasksRoot(workspaceRoot);
  try {
    if (!fs.existsSync(tasksRoot)) return [];
    return fs.readdirSync(tasksRoot, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== "_TEMPLATE")
      .map(e => path.join(tasksRoot, e.name))
      .filter(dir => fs.existsSync(path.join(dir, "task.json")));
  } catch {
    return [];
  }
}

function normalizeLabel(taskDir) {
  return path.resolve(taskDir).replaceAll("\\", "/");
}

function trimOutput(text) {
  return String(text || "")
    .trim()
    .split(/\r?\n/)
    .slice(0, 12)
    .join(" | ");
}

const findings = [];
const explicitTargets = parseTargets();
const rolloutTargets = discoverRolloutTaskTargets();
const targets = Array.from(new Set([...defaultContractTargets(), ...rolloutTargets, ...explicitTargets]));

if (targets.length === 0) {
  console.log("check-evidence-closeout: SKIPPED (no contract or explicit targets)");
  process.exit(0);
}

for (const target of targets) {
  const taskDir = resolveTaskDir(target);
  const label = normalizeLabel(taskDir);
  if (!fs.existsSync(taskFile(taskDir, "task.json"))) {
    findings.push(`[${label}] missing task.json`);
    continue;
  }

  const formal = runFormalValidation(taskDir);
  for (const finding of formal.errors || formal.findings || []) {
    findings.push(`[${label}] formal: ${finding}`);
  }

  const verifyScript = taskFile(taskDir, "run/verify-once.mjs");
  if (!fs.existsSync(verifyScript)) {
    findings.push(`[${label}] missing run/verify-once.mjs`);
  } else {
    const verify = spawnSync(process.execPath, [verifyScript, "--validate-only"], {
      cwd: taskDir,
      encoding: "utf8",
      timeout: 120000
    });
    if (verify.error) {
      findings.push(`[${label}] verify-once error: ${verify.error.message}`);
    } else if (verify.status !== 0) {
      findings.push(
        `[${label}] verify-once --validate-only failed: ${trimOutput(verify.stderr || verify.stdout)}`
      );
    }
  }

  const gate = evaluateCloseoutGate(taskDir);
  for (const finding of gate.errors || gate.findings || []) {
    findings.push(`[${label}] closeout: ${finding}`);
  }
}

failWith(findings, "check-evidence-closeout");
