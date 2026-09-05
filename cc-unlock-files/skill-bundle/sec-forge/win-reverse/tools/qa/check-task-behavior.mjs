import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { detect as detectWebShellTech } from "../task/detect-web-shell-tech.mjs";
import { archiveTaskSnapshot } from "../task/task-archive.mjs";
import { assertSafeWorkspaceRoot } from "../task/common.mjs";
import { defaultRouteStateDocument, resolveExecutionState } from "../task/route-state.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const taskStartScript = path.join(repoRoot, "tools", "task", "task-start.mjs");
const taskSyncScript = path.join(repoRoot, "tools", "task", "task-sync.mjs");
const taskAdvanceScript = path.join(repoRoot, "tools", "task", "task-advance.mjs");
const taskDrillScript = path.join(repoRoot, "tools", "task", "task-drill.mjs");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeEnv(workspaceRoot) {
  return {
    ...process.env,
    WIN_REVERSE_SKILL_ROOT: repoRoot,
    WIN_REVERSE_WORKSPACE_ROOT: workspaceRoot
  };
}

function runNode(scriptPath, args, workspaceRoot) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    env: makeEnv(workspaceRoot),
    encoding: "utf8"
  });
}

function ensureOk(result, label) {
  if (result.status === 0) {
    return;
  }
  throw new Error(
    `${label} failed\nstdout:\n${result.stdout || ""}\nstderr:\n${result.stderr || ""}`
  );
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function scenarioTaskLifecycle(tempRoot) {
  const workspaceRoot = path.join(tempRoot, "workspace-lifecycle");
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const taskInputPath = path.join(workspaceRoot, "valid-task-input.json");
  writeJson(taskInputPath, {
    target: {
      value: "behavior-sample",
      binaryPath: "samples/behavior-sample.exe"
    },
    objective: "验证 task-start/task-sync/task-advance 的行为闭环",
    requirements: {
      deliverables: [
        "report.md",
        "route-state.json"
      ],
      localReproductionRequested: true
    },
    boundaries: {
      inScope: [
        "静态分析",
        "本地调试"
      ],
      outOfScope: [
        "未授权对外联机"
      ]
    },
    runtime: {
      architecture: "x64",
      wow64: "unknown",
      managed: false,
      kernelMode: false
    },
    access: {
      adminRequired: true,
      interactiveUnlockRequired: false,
      driverSigningBypassRequired: false
    },
    focusSignals: [
      "CreateRemoteThread",
      "WinHttpSendRequest"
    ]
  });

  const startResult = runNode(
    taskStartScript,
    [
      "behavior-start",
      "--topics=static-triage,packer-unpack",
      `--task-input=${taskInputPath}`,
      "--local-repro"
    ],
    workspaceRoot
  );
  ensureOk(startResult, "task-start(new)");

  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", "behavior-start");
  const task = readJson(path.join(taskDir, "task.json"));
  assert(task.taskPacks.selectedTopics.includes("static-triage"), "selectedTopics missing static-triage");
  assert(task.taskPacks.selectedTopics.includes("packer-unpack"), "selectedTopics missing packer-unpack");
  assert(task.targetContext.inputTarget === "behavior-sample", "task input target not mapped");
  assert(task.targetContext.targetBinaryPath === "samples/behavior-sample.exe", "binaryPath not mapped");
  assert(task.runtime.architecture === "x64", "runtime.architecture not mapped");
  assert(task.accessRequirements.adminRequired === true, "access.adminRequired not mapped");
  assert(task.deliveryRequirements.localReproductionRequested === true, "local reproduction flag not inferred");

  const syncResult = runNode(taskSyncScript, ["behavior-start"], workspaceRoot);
  ensureOk(syncResult, "task-sync");

  const advanceResult = runNode(taskAdvanceScript, ["behavior-start", "--json"], workspaceRoot);
  ensureOk(advanceResult, "task-advance");
  const advancePayload = JSON.parse(advanceResult.stdout);
  assert(advancePayload.execution.status === "ready-to-continue", "execution.status should be ready-to-continue");
  assert(
    String(advancePayload.execution.nextExecutableAction || "").trim().length > 0,
    "nextExecutableAction should not be empty"
  );

  const blockedStart = runNode(taskStartScript, ["second-task"], workspaceRoot);
  assert(blockedStart.status !== 0, "task-start should block second task-local without --force-new-task");

  const forcedStart = runNode(
    taskStartScript,
    ["second-task", "--force-new-task", "--topic=dotnet"],
    workspaceRoot
  );
  ensureOk(forcedStart, "task-start(force-new-task)");
}

function scenarioSchemaEnforcement(tempRoot) {
  const workspaceRoot = path.join(tempRoot, "workspace-schema");
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const invalidTaskInputPath = path.join(workspaceRoot, "invalid-task-input.json");
  writeJson(invalidTaskInputPath, {
    target: {
      value: "invalid-sample"
    },
    objective: "验证 schema 强制执行",
    requirements: {
      deliverables: [
        "report.md"
      ],
      protocolReplayExampleRequired: true,
      localReproductionRequested: false
    },
    boundaries: {
      inScope: [
        "协议重放"
      ]
    }
  });

  const result = runNode(
    taskStartScript,
    ["schema-bad", `--task-input=${invalidTaskInputPath}`],
    workspaceRoot
  );
  assert(result.status !== 0, "invalid task input should fail");
  assert(
    `${result.stdout}\n${result.stderr}`.includes("task input failed schema validation"),
    "schema failure message should be surfaced"
  );
}

function scenarioDrillFlow(tempRoot) {
  const workspaceRoot = path.join(tempRoot, "workspace-drill");
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const result = runNode(
    taskDrillScript,
    ["packed-dotnet-loader", "behavior-drill"],
    workspaceRoot
  );
  ensureOk(result, "task-drill");

  const task = readJson(
    path.join(workspaceRoot, "artifacts", "tasks", "behavior-drill", "task.json")
  );
  assert(task.taskDrill.scenarioId === "packed-dotnet-loader", "taskDrill.scenarioId mismatch");
  assert(
    Array.isArray(task.taskDrill.topics) && task.taskDrill.topics.length >= 2,
    "drill topics should be materialized"
  );
  assert(
    task.deliveryRequirements.localReproductionRequested === true,
    "drill should seed local reproduction requirement"
  );
}

function scenarioUserPauseSemantics() {
  const task = {
    taskId: "pause-semantics",
    phase: "Observe",
    accessRequirements: {
      interactiveUnlockRequired: true
    },
    routeState: {}
  };
  const baseRouteState = defaultRouteStateDocument(task);
  const ready = resolveExecutionState(task, {
    ...baseRouteState,
    execution: {
      ...baseRouteState.execution,
      pauseCategory: "none",
      pauseReason: ""
    }
  });
  assert(
    ready.status === "ready-to-continue",
    "interactiveUnlockRequired metadata alone must not force blocked-on-user"
  );
  assert(
    Array.isArray(baseRouteState.tracks) && baseRouteState.tracks.some((track) => track.title === "C"),
    "default route-state should include Web shell / WebView fingerprint track C"
  );
  assert(
    Array.isArray(baseRouteState.entrypoints) && baseRouteState.entrypoints.some((entrypoint) => entrypoint.id === "EP-002"),
    "default route-state should include Web shell / WebView candidate EP-002"
  );

  const blocked = resolveExecutionState(task, {
    ...baseRouteState,
    execution: {
      ...baseRouteState.execution,
      pauseCategory: "user",
      pauseReason: "等待用户在 IDA 中加载新样本"
    }
  });
  assert(blocked.status === "blocked-on-user", "explicit pauseCategory=user should still block");
}

function scenarioWorkspaceGuard() {
  let threw = false;
  try {
    assertSafeWorkspaceRoot({
      workspace: repoRoot,
      skillRoot: repoRoot,
      installedSkillRoot: repoRoot,
      commandName: "check-task-behavior"
    });
  } catch (error) {
    threw = String(error?.message || error).includes("workspace root resolves inside the skill directory");
  }
  assert(threw, "workspace guard should reject creating running tasks inside the skill root");
}

function scenarioArchiveSnapshot(tempRoot) {
  const workspaceRoot = path.join(tempRoot, "workspace-archive");
  const installedSkillRoot = path.join(tempRoot, "installed-skills", "win-reverse");
  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", "archive-me");

  fs.mkdirSync(path.join(taskDir, "state"), { recursive: true });
  fs.mkdirSync(path.join(taskDir, "run"), { recursive: true });
  fs.mkdirSync(installedSkillRoot, { recursive: true });

  fs.writeFileSync(path.join(installedSkillRoot, "SKILL.md"), "---\nname: win-reverse\n---\n", "utf8");
  fs.writeFileSync(
    path.join(taskDir, "task.json"),
    JSON.stringify(
      {
        taskId: "archive-me",
        phase: "Port",
        roots: {
          skillRoot: repoRoot,
          workspaceRoot
        },
        routeState: {
          statePath: "state/route-state.json",
          planPath: "state/route-plan.md",
          cluesPath: "state/clues.md",
          progressPath: "state/progress.md"
        }
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  fs.writeFileSync(path.join(taskDir, "report.md"), "# report\n", "utf8");
  fs.writeFileSync(path.join(taskDir, "run", "fixtures.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(taskDir, "state", "route-state.json"), "{}\n", "utf8");

  const result = archiveTaskSnapshot(taskDir, {
    taskSkillRoot: repoRoot,
    installedSkillRoot
  });
  const archivedTaskDir = path.join(installedSkillRoot, "artifacts", "tasks", "archive-me");
  assert(result.archiveTaskDir === archivedTaskDir, "archiveTaskDir mismatch");
  assert(fs.existsSync(path.join(archivedTaskDir, "task.json")), "archived task.json missing");
  assert(fs.existsSync(path.join(archivedTaskDir, "report.md")), "archived report.md missing");
}

function scenarioWebShellTechDetection(tempRoot) {
  const root = path.join(tempRoot, "workspace-web-shell");
  const appDir = path.join(root, "TargetApp");
  fs.mkdirSync(path.join(appDir, "resources"), { recursive: true });
  fs.mkdirSync(path.join(appDir, "dist", "assets"), { recursive: true });
  fs.writeFileSync(path.join(appDir, "resources", "app.asar"), "placeholder", "utf8");
  fs.writeFileSync(
    path.join(appDir, "package.json"),
    JSON.stringify(
      {
        name: "target-app",
        main: "main.js",
        dependencies: {
          electron: "^30.0.0",
          react: "^19.0.0"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  fs.writeFileSync(
    path.join(appDir, "dist", "assets", "index.js"),
    "const root=createRoot(document.getElementById('root')); const x=__webpack_require__;",
    "utf8"
  );

  const result = detectWebShellTech(appDir, {
    maxDepth: 4,
    maxFiles: 2000,
    maxReadBytes: 64 * 1024
  });
  assert(result.summary.looksLikeWebShell === true, "web-shell detector should flag Electron-like app");
  assert(
    result.summary.probableRuntimes.some((item) => item.key === "electron"),
    "web-shell detector should identify electron"
  );
  assert(
    result.summary.probableFrontend.some((item) => item.key === "react"),
    "web-shell detector should identify react"
  );
  assert(
    result.summary.probablePackagers.some((item) => item.key === "webpack"),
    "web-shell detector should identify webpack"
  );
}

function scenarioWebShellTopicAutoAdvance(tempRoot) {
  const workspaceRoot = path.join(tempRoot, "workspace-web-shell-topic");
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const startResult = runNode(
    taskStartScript,
    ["web-shell-auto", "--topic=web-shell-triage"],
    workspaceRoot
  );
  ensureOk(startResult, "task-start(web-shell-triage)");

  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", "web-shell-auto");
  writeJson(path.join(taskDir, "run", "web-shell-tech.json"), {
    generatedAt: new Date().toISOString(),
    scannedRoot: "C:/TargetApp",
    summary: {
      looksLikeWebShell: true,
      confidence: "high",
      probableRuntimes: [{ key: "electron", score: 11 }],
      probableFrontend: [{ key: "react", score: 6 }],
      probablePackagers: [{ key: "webpack", score: 7 }]
    },
    entryHints: ["resources/app.asar", "package.json", "preload.js"],
    recommendedNextSteps: [
      "优先检查 resources/app.asar、package.json 和 preload.js"
    ],
    matches: []
  });

  const syncResult = runNode(taskSyncScript, ["web-shell-auto"], workspaceRoot);
  ensureOk(syncResult, "task-sync(web-shell-triage)");

  const task = readJson(path.join(taskDir, "task.json"));
  assert(task.webShellTriage.status === "fingerprinted", "webShellTriage.status should be fingerprinted after task-sync");
  assert(
    task.webShellTriage.probableRuntimes.includes("electron"),
    "task-sync should ingest probable runtime"
  );
  assert(
    task.webShellTriage.entryHints.includes("resources/app.asar"),
    "task-sync should ingest entry hints"
  );
  assert(
    task.webShellTriage.downstreamTopics.includes("config-recovery") &&
    task.webShellTriage.downstreamTopics.includes("ui-runtime") &&
    task.webShellTriage.downstreamTopics.includes("tls-network"),
    "web-shell routing should auto-suggest downstream topics for electron-like targets"
  );
  assert(
    task.taskPacks.selectedTopics.includes("config-recovery") &&
    task.taskPacks.selectedTopics.includes("ui-runtime") &&
    task.taskPacks.selectedTopics.includes("tls-network"),
    "task-sync should auto-infer downstream topics from web-shell detection result"
  );
  assert(
    fs.existsSync(path.join(taskDir, "run", "web-shell-next-steps.md")),
    "task-sync should auto-generate run/web-shell-next-steps.md"
  );
  const nextStepsText = fs.readFileSync(path.join(taskDir, "run", "web-shell-next-steps.md"), "utf8");
  assert(
    nextStepsText.includes("contextBridge") && nextStepsText.includes("ipcMain"),
    "electron next-step template should include Electron-specific bridge actions"
  );
  const reportText = fs.readFileSync(path.join(taskDir, "report.md"), "utf8");
  assert(
    reportText.includes("## Runtime 专用后续动作模板摘要"),
    "task-sync should sync runtime-specific summary into a fixed report.md section"
  );
  assert(
    reportText.includes("electron-like") && reportText.includes("config-recovery"),
    "runtime summary section should include routing profile and downstream topics"
  );
  assert(
    reportText.includes("run/web-shell-next-steps.md"),
    "runtime summary section should reference runtime-specific artifact paths"
  );

  const routeState = readJson(path.join(taskDir, "state", "route-state.json"));
  const ep2 = (routeState.entrypoints || []).find((entrypoint) => entrypoint.id === "EP-002");
  assert(ep2?.status === "SUCCESS", "EP-002 should be marked SUCCESS after meaningful web-shell detection");

  const advanceResult = runNode(taskAdvanceScript, ["web-shell-auto", "--json"], workspaceRoot);
  ensureOk(advanceResult, "task-advance(web-shell-triage)");
  const payload = JSON.parse(advanceResult.stdout);
  assert(
    String(payload.execution.nextExecutableAction || "").includes("app.asar"),
    "nextExecutableAction should be tailored from web-shell detection result"
  );
  assert(
    String(payload.execution.nextExecutableAction || "").includes("config-recovery"),
    "nextExecutableAction should include downstream routing hint"
  );
}

function scenarioWebShellTopicAutoInference(tempRoot) {
  const workspaceRoot = path.join(tempRoot, "workspace-web-shell-auto-infer");
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const appDir = path.join(workspaceRoot, "TargetAutoApp");
  fs.mkdirSync(path.join(appDir, "resources"), { recursive: true });
  fs.mkdirSync(path.join(appDir, "dist"), { recursive: true });
  fs.writeFileSync(path.join(appDir, "resources", "app.asar"), "placeholder", "utf8");
  fs.writeFileSync(
    path.join(appDir, "package.json"),
    JSON.stringify({
      name: "auto-app",
      dependencies: {
        electron: "^30.0.0",
        react: "^19.0.0"
      }
    }, null, 2),
    "utf8"
  );
  fs.writeFileSync(path.join(appDir, "TargetAutoApp.exe"), "MZ", "utf8");

  const taskInputPath = path.join(workspaceRoot, "web-shell-task-input.json");
  writeJson(taskInputPath, {
    target: {
      value: "TargetAutoApp",
      binaryPath: path.join(appDir, "TargetAutoApp.exe")
    },
    objective: "验证未显式选 topic 时可自动推断 web-shell-triage",
    requirements: {
      deliverables: ["report.md"]
    },
    boundaries: {
      inScope: ["静态分析"]
    }
  });

  const startResult = runNode(
    taskStartScript,
    ["web-shell-auto-infer", `--task-input=${taskInputPath}`],
    workspaceRoot
  );
  ensureOk(startResult, "task-start(auto-infer-web-shell)");

  const syncResult = runNode(taskSyncScript, ["web-shell-auto-infer"], workspaceRoot);
  ensureOk(syncResult, "task-sync(auto-infer-web-shell)");

  const taskDir = path.join(workspaceRoot, "artifacts", "tasks", "web-shell-auto-infer");
  const task = readJson(path.join(taskDir, "task.json"));
  assert(
    task.taskPacks.selectedTopics.includes("web-shell-triage"),
    "task-sync should auto-infer web-shell-triage from target directory signals"
  );
  assert(
    fs.existsSync(path.join(taskDir, "run", "web-shell-tech.json")),
    "task-sync should auto-generate run/web-shell-tech.json when target path strongly matches web-shell app"
  );
  assert(
    fs.existsSync(path.join(taskDir, "run", "web-shell-notes.md")),
    "task-sync should auto-generate run/web-shell-notes.md when target path strongly matches web-shell app"
  );
  assert(
    fs.existsSync(path.join(taskDir, "run", "web-shell-next-steps.md")),
    "auto-inferred web-shell flow should also generate runtime-specific next steps"
  );
  assert(
    task.taskPacks.selectedTopics.includes("config-recovery") &&
    task.taskPacks.selectedTopics.includes("ui-runtime") &&
    task.taskPacks.selectedTopics.includes("tls-network"),
    "auto-inferred web-shell flow should also infer downstream topics"
  );
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "win-reverse-behavior-"));
  try {
    scenarioTaskLifecycle(tempRoot);
    scenarioSchemaEnforcement(tempRoot);
    scenarioDrillFlow(tempRoot);
    scenarioUserPauseSemantics();
    scenarioWorkspaceGuard();
    scenarioArchiveSnapshot(tempRoot);
    scenarioWebShellTechDetection(tempRoot);
    scenarioWebShellTopicAutoAdvance(tempRoot);
    scenarioWebShellTopicAutoInference(tempRoot);
    console.log("check-task-behavior: OK");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main();
