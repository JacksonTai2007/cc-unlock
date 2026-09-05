import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { failWith, repoRoot } from "./common.mjs";
import { evaluateCloseoutGate } from "../task/validation.mjs";

const findings = [];
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "android-reverse-workflow-gates-"));
const taskId = "workflow-gates";
const inputPath = path.join(tempRoot, "task-input.json");

fs.writeFileSync(
  inputPath,
  JSON.stringify(
    {
      target: "samples/demo.apk",
      targetType: "apk",
      objective: "优先使用 mt-mcp 辅助观察 smali patch 风险",
      requirements: {
        summary: "先验证用户指定工具，再推进 patch 分析",
        deliverables: ["report.md"]
      },
      boundaries: {
        summary: "授权样本，仅做本地验证"
      },
      declaredTools: ["mt-mcp"],
      preferredTools: ["mt-mcp"],
      completionCriteria: ["必须记录 mt-mcp 可用性或阻塞原因，并给出下一步证据路径"]
    },
    null,
    2
  ) + "\n"
);

const env = {
  ...process.env,
  ANDROID_REVERSE_WORKSPACE_ROOT: tempRoot
};

const init = spawnSync(process.execPath, ["tools/task/task-init.mjs", taskId, `--task-input=${inputPath}`], {
  cwd: repoRoot,
  env,
  encoding: "utf8"
});

if (init.status !== 0) {
  findings.push(`task-init failed: ${(init.stderr || init.stdout || "").trim()}`);
} else {
  const taskPath = path.join(tempRoot, "artifacts", "tasks", taskId, "task.json");
  const routeStatePath = path.join(tempRoot, "artifacts", "tasks", taskId, "state", "route-state.json");
  const task = JSON.parse(fs.readFileSync(taskPath, "utf8"));
  if (!task.toolchain?.declaredMcpTools?.includes("mt-mcp")) {
    findings.push("task-init should persist mt-mcp in task.toolchain.declaredMcpTools");
  }
  if (!task.toolchain?.preferredTools?.includes("mt-mcp")) {
    findings.push("task-init should persist mt-mcp in task.toolchain.preferredTools");
  }
  if (!String(task.toolchain?.foregroundRequirements || []).includes("MT Manager")) {
    findings.push("task-init should record MT Manager foreground requirement for mt-mcp");
  }

  const routeState = JSON.parse(fs.readFileSync(routeStatePath, "utf8"));

  const advance = spawnSync(process.execPath, ["tools/task/task-advance.mjs", taskId, "--json"], {
    cwd: repoRoot,
    env,
    encoding: "utf8"
  });
  if (advance.status !== 0) {
    findings.push(`task-advance failed: ${(advance.stderr || advance.stdout || "").trim()}`);
  } else {
    const payload = JSON.parse(advance.stdout);
    if (payload.execution?.status !== "needs-tool-preflight") {
      findings.push(`mt-mcp preferred tool should force needs-tool-preflight before downgrade, got ${payload.execution?.status}`);
    }
    if (!String(payload.execution?.pauseReason || "").includes("mt-mcp")) {
      findings.push("mt tool preflight pauseReason should mention mt-mcp");
    }
  }

  const recordTool = spawnSync(
    process.execPath,
    [
      "tools/task/task-record-attempt.mjs",
      taskId,
      "--kind=tool",
      "--status=success",
      "--tool=mt-mcp",
      "--strategy=mcp-http-preflight",
      "--actual=initialize and tools/list succeeded",
      "--evidence=run/mt-preflight.log",
      "--endpoint=http://192.168.6.100:8787/mcp",
      "--foreground",
      "--tools-listed",
      "--json"
    ],
    {
      cwd: repoRoot,
      env,
      encoding: "utf8"
    }
  );
  if (recordTool.status !== 0) {
    findings.push(`task-record-attempt tool preflight failed: ${(recordTool.stderr || recordTool.stdout || "").trim()}`);
  } else {
    const routeStateAfterTool = JSON.parse(fs.readFileSync(routeStatePath, "utf8"));
    if (routeStateAfterTool.toolReadiness?.tools?.["mt-mcp"]?.status !== "verified") {
      findings.push("task-record-attempt should mark mt-mcp toolReadiness as verified");
    }
  }

  for (let index = 0; index < 3; index += 1) {
    const recordFailure = spawnSync(
      process.execPath,
      [
        "tools/task/task-record-attempt.mjs",
        taskId,
        "--kind=probe",
        "--status=failed",
        "--tool=frida",
        "--strategy=attach-homepage-response-hook",
        "--entrypoint=EP-001",
        "--actual=hook script loaded but target callback did not fire",
        "--classification=frida-hook-miss",
        `--evidence=run/frida-hook-miss-${index + 1}.log`,
        "--json"
      ],
      {
        cwd: repoRoot,
        env,
        encoding: "utf8"
      }
    );
    if (recordFailure.status !== 0) {
      findings.push(`task-record-attempt failed probe ${index + 1}: ${(recordFailure.stderr || recordFailure.stdout || "").trim()}`);
    }
  }

  const advanceAfterFailures = spawnSync(process.execPath, ["tools/task/task-advance.mjs", taskId, "--json"], {
    cwd: repoRoot,
    env,
    encoding: "utf8"
  });
  if (advanceAfterFailures.status !== 0) {
    findings.push(`task-advance after failures failed: ${(advanceAfterFailures.stderr || advanceAfterFailures.stdout || "").trim()}`);
  } else {
    const payload = JSON.parse(advanceAfterFailures.stdout);
    if (payload.execution?.status !== "needs-retrospective") {
      findings.push(`stop-loss should force needs-retrospective, got ${payload.execution?.status}`);
    }
    if (payload.execution?.autoAdvanceEligible !== false) {
      findings.push("stop-loss should set autoAdvanceEligible=false");
    }
    if (!String(payload.execution?.pauseReason || "").includes("连续失败")) {
      findings.push("stop-loss pauseReason should explain the repeated-failure trigger");
    }
  }
}

const closeoutTaskDir = path.join(tempRoot, "artifacts", "tasks", "partial-closeout");
fs.mkdirSync(closeoutTaskDir, { recursive: true });
fs.writeFileSync(
  path.join(closeoutTaskDir, "task.json"),
  JSON.stringify(
    {
      taskId: "partial-closeout",
      objective: "验证所有验收项都命中后才能关闭",
      deliverableTier: "T3",
      phase: "Patch",
      protectionTier: "A0",
      completionCriteria: [
        { label: "homepage verified", hit: true },
        { label: "theater verified", hit: false }
      ],
      successCriteria: [],
      routeState: {},
      validation: {
        status: "passed",
        lastVerifiedAt: "2099-01-01T00:00:00.000Z",
        notes: []
      }
    },
    null,
    2
  ) + "\n"
);
const closeoutGate = evaluateCloseoutGate(closeoutTaskDir);
if (closeoutGate.ok) {
  findings.push("closeout should fail when only part of completionCriteria is hit");
}
if (!closeoutGate.errors.join("\n").includes("1/2")) {
  findings.push("closeout partial-criteria error should include hit ratio 1/2");
}

const patchInputPath = path.join(tempRoot, "patch-input.json");
fs.writeFileSync(
  patchInputPath,
  JSON.stringify(
    {
      target: "samples/demo.apk",
      targetType: "apk",
      objective: "验证 patch candidate 必须可回退",
      requirements: {
        deliverables: ["final.apk"]
      },
      boundaries: {
        summary: "授权样本，仅做本地验证"
      },
      completionCriteria: ["安装并验证关键路径"]
    },
    null,
    2
  ) + "\n"
);
const patchInit = spawnSync(process.execPath, ["tools/task/task-init.mjs", "patch-rollback-gate", `--task-input=${patchInputPath}`, "--force-new-task"], {
  cwd: repoRoot,
  env,
  encoding: "utf8"
});
if (patchInit.status !== 0) {
  findings.push(`patch rollback task-init failed: ${(patchInit.stderr || patchInit.stdout || "").trim()}`);
} else {
  const patchAttempt = spawnSync(
    process.execPath,
    [
      "tools/task/task-record-attempt.mjs",
      "patch-rollback-gate",
      "--kind=patch",
      "--status=failed",
      "--candidate=PATCH-001",
      "--strategy=homepage-cache-patch",
      "--hypothesis=cache write causes second launch error",
      "--expected=second launch no longer shows network error",
      "--evidence=run/fact-012.log",
      "--actual=still failed",
      "--json"
    ],
    {
      cwd: repoRoot,
      env,
      encoding: "utf8"
    }
  );
  if (patchAttempt.status === 0) {
    findings.push("patch attempt without rollback should be rejected");
  }
  if (!String(patchAttempt.stderr || "").includes("--rollback")) {
    findings.push("patch rollback rejection should explain that --rollback is required");
  }
}

failWith(findings, "check-workflow-gates");
