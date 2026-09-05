import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureTaskRuntimeShape, readTaskJson } from "../task/common.mjs";
import { defaultRouteStateDocument, resolveExecutionState } from "../task/route-state.mjs";
import { cleanupTaskArtifacts } from "../task/task-cleanup.mjs";
import { evaluateCloseoutGate, runFormalValidation } from "../task/validation.mjs";
import { failWith, repoRoot } from "./common.mjs";

const findings = [];
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "android-reverse-repair-regressions-"));

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeTask(taskId, overrides = {}) {
  const taskDir = path.join(tempRoot, taskId);
  fs.mkdirSync(path.join(taskDir, "run"), { recursive: true });
  writeJson(path.join(taskDir, "task.json"), {
    schemaVersion: 2,
    taskId,
    objective: `验证 ${taskId}`,
    deliverableTier: "T1",
    deliverables: [
      {
        id: "primary",
        tier: "T1",
        criteriaIds: ["criterion-1"],
        status: "in-progress"
      }
    ],
    currentDeliverableId: "primary",
    phase: "Observe",
    protectionTier: null,
    completionCriteria: [
      {
        id: "criterion-1",
        label: "保留一条可验证标准",
        status: "pending",
        evidenceRefs: []
      }
    ],
    routeState: {},
    validation: {
      status: "not-started",
      lastVerifiedAt: "",
      notes: []
    },
    deliveryRequirements: {
      localReproductionRequested: false,
      apiCallExampleRequired: false
    },
    ...overrides
  });
  fs.writeFileSync(
    path.join(taskDir, "report.md"),
    [
      "# 回归报告",
      "",
      "## 当前阶段",
      "",
      "- 当前阶段：`Observe`",
      "- 当前状态：正在验证修复。",
      "",
      "## 自动续跑决策",
      "",
      "- 执行状态：`ready-to-continue`",
      "- 暂停类别：`none`",
      "- 暂停原因：无",
      "- 下一可执行动作：`继续回归验证`",
      "",
      "## 下一步",
      "",
      "- 继续回归验证。",
      ""
    ].join("\n")
  );
  writeJson(path.join(taskDir, "run", "fixtures.json"), {});
  return taskDir;
}

const nestedRunTask = makeTask("nested-run-directory");
fs.mkdirSync(path.join(nestedRunTask, "run", "captured"), { recursive: true });
fs.writeFileSync(path.join(nestedRunTask, "run", "captured", "sample.log"), "sample\n");
try {
  runFormalValidation(nestedRunTask);
} catch (error) {
  findings.push(`formal validation must not throw for run/ subdirectories: ${error.message}`);
}

const criteriaTaskDir = makeTask("criteria-exact-status", {
  schemaVersion: 1,
  completionCriteria: ["method evidence recorded"],
  deliverables: undefined,
  currentDeliverableId: undefined,
  validation: {
    status: "passed",
    lastVerifiedAt: "2099-01-01T00:00:00.000Z",
    notes: []
  }
});
const criteriaGate = evaluateCloseoutGate(criteriaTaskDir);
if (criteriaGate.ok) {
  findings.push("completion criteria must not treat the substring 'met' in 'method' as a completed status");
}

const normalizedCriteriaTask = ensureTaskRuntimeShape({
  completionCriteria: ["canonical criterion"],
  successCriteria: ["legacy-only criterion"]
});
if (normalizedCriteriaTask.completionCriteria.length !== 1 || normalizedCriteriaTask.completionCriteria[0] !== "canonical criterion") {
  findings.push("completionCriteria must remain canonical instead of being merged with successCriteria");
}

const staticEnvironmentTask = ensureTaskRuntimeShape({ executionContext: { deviceMode: "unassessed" } });
if (
  staticEnvironmentTask.executionContext.deviceMode !== "none" ||
  staticEnvironmentTask.executionContext.deviceReady !== false ||
  staticEnvironmentTask.executionContext.rooted !== null
) {
  findings.push("static or unassessed tasks must normalize to deviceMode=none, deviceReady=false, rooted=null");
}
const physicalEnvironmentTask = ensureTaskRuntimeShape({
  executionContext: { deviceMode: "physical", deviceReady: true, rooted: false }
});
if (
  physicalEnvironmentTask.executionContext.deviceMode !== "physical" ||
  physicalEnvironmentTask.executionContext.deviceReady !== true ||
  physicalEnvironmentTask.executionContext.rooted !== false
) {
  findings.push("an assessed physical-device environment must survive task normalization");
}

const nullTierTaskDir = makeTask("unknown-protection-tier");
const nullTierTask = readTaskJson(nullTierTaskDir);
if (nullTierTask.protectionTier !== null) {
  findings.push(`an unassessed protectionTier must remain null, got ${nullTierTask.protectionTier}`);
}

const compositeTaskDir = makeTask("composite-deliverables", {
  deliverables: [
    { id: "patch", tier: "T3", criteriaIds: ["criterion-1"], status: "delivered" },
    { id: "port", tier: "T5", criteriaIds: ["criterion-1"], status: "acceptance-ready" }
  ],
  completionCriteria: [
    { id: "criterion-1", label: "已有证据", status: "met", evidenceRefs: ["run/fixtures.json"] }
  ],
  validation: {
    status: "passed",
    lastVerifiedAt: "2099-01-01T00:00:00.000Z",
    notes: []
  }
});
const compositeGate = evaluateCloseoutGate(compositeTaskDir);
if (compositeGate.ok || !compositeGate.errors.join("\n").includes("port")) {
  findings.push("a composite task must not close while a required deliverable is not delivered");
}

const patchGateTaskDir = makeTask("patch-baseline-gate", {
  deliverableTier: "T3",
  deliverables: [
    { id: "patch", tier: "T3", criteriaIds: ["criterion-1"], status: "delivered" }
  ],
  currentDeliverableId: "patch",
  phase: "Patch",
  completionCriteria: [
    { id: "criterion-1", label: "关键路径已有证据", status: "met", evidenceRefs: ["run/fixtures.json"] }
  ],
  validation: {
    status: "passed",
    lastVerifiedAt: "2099-01-01T00:00:00.000Z",
    notes: []
  }
});
const patchGate = evaluateCloseoutGate(patchGateTaskDir);
if (patchGate.ok || !patchGate.errors.some((item) => item.includes("no-op re-sign baseline"))) {
  findings.push("T3 closeout must require a no-op re-sign baseline");
}
const patchTask = readTaskJson(patchGateTaskDir);
const patchRouteState = defaultRouteStateDocument(patchTask);
const patchExecution = resolveExecutionState(patchTask, patchRouteState);
if (patchExecution.status !== "needs-evidence" || !patchExecution.pauseReason.includes("no-op")) {
  findings.push("T3 Patch phase must block business patching until the no-op baseline is recorded");
}

const patchRecordArgs = [
  "tools/task/task-record-attempt.mjs",
  patchGateTaskDir,
  "--kind=patch",
  "--status=inconclusive",
  "--candidate=PATCH-001",
  "--strategy=minimal-root-cause",
  "--hypothesis=the target branch is the minimal cause",
  "--expected=cold start remains stable",
  "--actual=candidate prepared",
  "--evidence=run/fixtures.json",
  "--rollback=restore the no-op baseline"
];
const patchWithoutBaseline = spawnSync(process.execPath, patchRecordArgs, {
  cwd: repoRoot,
  env: { ...process.env, ANDROID_REVERSE_WORKSPACE_ROOT: tempRoot },
  encoding: "utf8"
});
if (patchWithoutBaseline.status === 0 || !String(patchWithoutBaseline.stderr).includes("no-op re-sign baseline")) {
  findings.push("task-record-attempt must reject an applied business patch before the no-op baseline");
}
const patchProposal = spawnSync(process.execPath, [...patchRecordArgs, "--proposal"], {
  cwd: repoRoot,
  env: { ...process.env, ANDROID_REVERSE_WORKSPACE_ROOT: tempRoot },
  encoding: "utf8"
});
if (patchProposal.status !== 0) {
  findings.push(`a patch candidate proposal should be recordable before baseline: ${(patchProposal.stderr || patchProposal.stdout || "").trim()}`);
}

const allAdsTaskDir = makeTask("all-ads-regression-matrix", {
  objective: "去除所有广告并保持登录查询功能",
  deliverableTier: "T3",
  deliverables: [{ id: "remove-ads", tier: "T3", criteriaIds: ["criterion-1"], status: "delivered" }],
  completionCriteria: [{ id: "criterion-1", label: "广告路径已验证", status: "met", evidenceRefs: ["run/fixtures.json"] }],
  validation: { status: "passed", lastVerifiedAt: "2099-01-01T00:00:00.000Z", notes: [] },
  patchBaseline: {
    status: "passed",
    sourceArtifactSha256: "a".repeat(64),
    resignedArtifactSha256: "b".repeat(64),
    signatureVerified: true,
    installed: true,
    launched: true,
    usedUninstall: false,
    userApprovedDataReset: false,
    evidenceRefs: ["run/fixtures.json"]
  },
  patchRegressionMatrix: ["cold-start", "core-path", "signature-integrity"].map((id) => ({
    id,
    status: "passed",
    evidenceRefs: ["run/fixtures.json"]
  }))
});
const allAdsGate = evaluateCloseoutGate(allAdsTaskDir);
if (allAdsGate.ok || !allAdsGate.errors.some((item) => item.includes("login-sso"))) {
  findings.push("an all-ads T3 task must not close after testing only the base startup path");
}

const absentSurfaceTaskDir = makeTask("all-ads-absent-login", {
  objective: "去除所有广告；该应用经组件清单确认不存在登录入口",
  deliverableTier: "T3",
  deliverables: [{ id: "remove-ads", tier: "T3", criteriaIds: ["criterion-1"], status: "delivered" }],
  currentDeliverableId: "remove-ads",
  completionCriteria: [{ id: "criterion-1", label: "广告路径已验证", status: "met", evidenceRefs: ["run/fixtures.json"] }],
  validation: { status: "passed", lastVerifiedAt: "2099-01-01T00:00:00.000Z", notes: [] },
  patchBaseline: {
    status: "passed",
    sourceArtifactSha256: "a".repeat(64),
    resignedArtifactSha256: "b".repeat(64),
    signatureVerified: true,
    installed: true,
    launched: true,
    usedUninstall: false,
    userApprovedDataReset: false,
    evidenceRefs: ["run/fixtures.json"]
  },
  patchRegressionMatrix: [
    ...["cold-start", "core-path", "signature-integrity", "onboarding", "home", "query-results", "deep-navigation", "resume"].map((id) => ({
      id,
      status: "passed",
      evidenceRefs: ["run/fixtures.json"]
    })),
    {
      id: "login-sso",
      status: "not-applicable",
      rationale: "manifest and component map contain no authentication entry point",
      evidenceRefs: ["run/fixtures.json"]
    }
  ]
});
const absentSurfaceGate = evaluateCloseoutGate(absentSurfaceTaskDir);
if (absentSurfaceGate.errors.some((item) => item.includes("login-sso"))) {
  findings.push("an absent business surface with rationale and evidence must be accepted as not-applicable");
}

const unsupportedAbsentSurfaceTask = readTaskJson(absentSurfaceTaskDir);
unsupportedAbsentSurfaceTask.patchRegressionMatrix.find((item) => item.id === "login-sso").rationale = "";
writeJson(path.join(absentSurfaceTaskDir, "task.json"), unsupportedAbsentSurfaceTask);
const unsupportedAbsentSurfaceGate = evaluateCloseoutGate(absentSurfaceTaskDir);
if (!unsupportedAbsentSurfaceGate.errors.some((item) => item.includes("login-sso"))) {
  findings.push("not-applicable must not waive a business surface without a rationale");
}

const a4BoundaryTaskDir = makeTask("a4-without-ollvm", {
  protectionTier: "A4",
  phase: "Capture"
});
const a4BoundaryTask = readTaskJson(a4BoundaryTaskDir);
const a4Execution = resolveExecutionState(a4BoundaryTask, defaultRouteStateDocument(a4BoundaryTask));
if (a4Execution.status !== "ready-to-continue") {
  findings.push(`A4 without OLLVM signals must allow boundary evidence collection, got ${a4Execution.status}`);
}

const baselineSafetyTaskDir = makeTask("baseline-uninstall-safety", {
  deliverableTier: "T3",
  deliverables: [{ id: "patch", tier: "T3", criteriaIds: ["criterion-1"], status: "in-progress" }]
});
const originalApk = path.join(baselineSafetyTaskDir, "run", "original.apk");
const resignedApk = path.join(baselineSafetyTaskDir, "run", "resigned.apk");
fs.writeFileSync(originalApk, "original");
fs.writeFileSync(resignedApk, "resigned");
const unsafeUninstallBaseline = spawnSync(
  process.execPath,
  [
    "tools/task/task-baseline.mjs",
    baselineSafetyTaskDir,
    `--source=${originalApk}`,
    `--resigned=${resignedApk}`,
    "--evidence=run/fixtures.json",
    "--signature-verified",
    "--installed",
    "--launched",
    "--used-uninstall"
  ],
  {
    cwd: repoRoot,
    env: { ...process.env, ANDROID_REVERSE_WORKSPACE_ROOT: tempRoot },
    encoding: "utf8"
  }
);
if (unsafeUninstallBaseline.status === 0 || !String(unsafeUninstallBaseline.stderr).includes("data-reset-approved")) {
  findings.push("task-baseline must reject uninstall-based baselines without explicit data reset approval");
}

const blankReportTaskDir = makeTask("blank-local-report", {
  deliveryRequirements: {
    localReproductionRequested: true,
    apiCallExampleRequired: false
  }
});
fs.appendFileSync(
  path.join(blankReportTaskDir, "report.md"),
  [
    "## 本地复现交付",
    "",
    "- 本地算法实现: ",
    "- 调用示例: ",
    "- 运行命令: ",
    "- 样例输入: ",
    "- 输出 / 响应摘要: ",
    ""
  ].join("\n")
);
const blankReportValidation = runFormalValidation(blankReportTaskDir);
if (!blankReportValidation.errors.some((item) => item.includes("non-empty local algorithm"))) {
  findings.push("blank local reproduction report fields must not consume the next Markdown line as their value");
}

const falseUserClaimTaskDir = makeTask("false-user-confirmation");
fs.appendFileSync(path.join(falseUserClaimTaskDir, "report.md"), "\n- 用户已确认真实登录验证通过。\n");
const falseUserClaimValidation = runFormalValidation(falseUserClaimTaskDir);
if (!falseUserClaimValidation.errors.some((item) => item.includes("claims user confirmation"))) {
  findings.push("reports must not claim user confirmation without structured conversation evidence");
}

const verificationTaskDir = makeTask("typed-local-verification", {
  deliverableTier: "T5",
  deliverables: [
    { id: "local-port", tier: "T5", criteriaIds: ["criterion-1"], status: "acceptance-ready" }
  ],
  deliveryRequirements: {
    localReproductionRequested: true,
    apiCallExampleRequired: false
  }
});
fs.writeFileSync(
  path.join(verificationTaskDir, "run", "implementation.py"),
  [
    "import hashlib",
    "import json",
    "import os",
    "import sys",
    "value = sys.argv[1]",
    "print(json.dumps({'input': value, 'digest': hashlib.sha256(value.encode()).hexdigest(), 'secretVisible': 'SECRET_TEST_TOKEN' in os.environ}))",
    ""
  ].join("\n")
);
writeJson(path.join(verificationTaskDir, "run", "verification.spec.json"), {
  schemaVersion: 1,
  cases: [
    {
      id: "alpha-vector",
      role: "local-reproduction",
      runner: "python",
      entrypoint: "run/implementation.py",
      args: ["alpha"],
      assertions: [
        {
          type: "stdout-json-equals",
          path: "digest",
          value: "8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8"
        },
        {
          type: "stdout-json-equals",
          path: "secretVisible",
          value: false
        }
      ]
    },
    {
      id: "beta-vector",
      role: "local-reproduction",
      runner: "python",
      entrypoint: "run/implementation.py",
      args: ["beta"],
      assertions: [
        {
          type: "stdout-json-equals",
          path: "digest",
          value: "f44e64e75f3948e9f73f8dfa94721c4ce8cbb4f265c4790c702b2d41cfbf2753"
        }
      ]
    }
  ]
});
const verifyRun = spawnSync(process.execPath, ["tools/task/task-verify.mjs", verificationTaskDir], {
  cwd: repoRoot,
  env: {
    ...process.env,
    SECRET_TEST_TOKEN: "must-not-reach-task-code",
    ANDROID_REVERSE_WORKSPACE_ROOT: tempRoot
  },
  encoding: "utf8"
});
if (verifyRun.status !== 0) {
  findings.push(`typed task verification should execute declared Python vectors: ${(verifyRun.stderr || verifyRun.stdout || "").trim()}`);
} else {
  const resultPath = path.join(verificationTaskDir, "run", "verification-result.json");
  if (!fs.existsSync(resultPath)) {
    findings.push("task-verify must persist run/verification-result.json");
  } else {
    const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    if (result.ok !== true || result.cases?.length !== 2) {
      findings.push("task-verify result must record both passing test vectors");
    }
  }
}

fs.appendFileSync(path.join(verificationTaskDir, "run", "implementation.py"), "# changed after verification\n");
const staleValidation = runFormalValidation(verificationTaskDir);
if (!staleValidation.errors.some((item) => item.includes("stale") && item.includes("changed"))) {
  findings.push("verification evidence must become stale when the verified entrypoint changes");
}

const emptyAssertionTaskDir = makeTask("empty-output-assertion", {
  deliverableTier: "T5",
  deliveryRequirements: { localReproductionRequested: true, apiCallExampleRequired: false }
});
fs.writeFileSync(path.join(emptyAssertionTaskDir, "run", "noop.py"), "print('ok')\n");
writeJson(path.join(emptyAssertionTaskDir, "run", "verification.spec.json"), {
  schemaVersion: 1,
  cases: [
    {
      id: "no-output-check",
      role: "local-reproduction",
      runner: "python",
      entrypoint: "run/noop.py",
      args: [],
      assertions: [{ type: "stderr-empty" }]
    }
  ]
});
const emptyAssertionVerify = spawnSync(process.execPath, ["tools/task/task-verify.mjs", emptyAssertionTaskDir], {
  cwd: repoRoot,
  env: { ...process.env, ANDROID_REVERSE_WORKSPACE_ROOT: tempRoot },
  encoding: "utf8"
});
if (emptyAssertionVerify.status === 0 || !String(emptyAssertionVerify.stderr).includes("discriminating stdout assertion")) {
  findings.push("task-verify must reject cases that only check exit status or empty stderr");
}


const outsideEntrypoint = path.join(tempRoot, "outside.py");
fs.writeFileSync(outsideEntrypoint, "print('outside')\n");
const unsafeVerificationTaskDir = makeTask("unsafe-verification-path", {
  deliverableTier: "T5",
  deliveryRequirements: { localReproductionRequested: true, apiCallExampleRequired: false }
});
writeJson(path.join(unsafeVerificationTaskDir, "run", "verification.spec.json"), {
  schemaVersion: 1,
  cases: [
    {
      id: "escape",
      role: "local-reproduction",
      runner: "python",
      entrypoint: "../outside.py",
      args: [],
      assertions: [{ type: "stdout-equals", value: "outside" }]
    }
  ]
});
const unsafeVerify = spawnSync(process.execPath, ["tools/task/task-verify.mjs", unsafeVerificationTaskDir], {
  cwd: repoRoot,
  env: { ...process.env, ANDROID_REVERSE_WORKSPACE_ROOT: tempRoot },
  encoding: "utf8"
});
if (unsafeVerify.status === 0 || !String(unsafeVerify.stderr).includes("inside the task directory")) {
  findings.push("task-verify must reject entrypoints that escape the task directory");
}

const compositeInputPath = path.join(tempRoot, "composite-input.json");
writeJson(compositeInputPath, {
  target: "samples/demo.apk",
  objective: "修改 APK 去除广告，并提供不依赖 Android 的纯 Python 查询实现",
  requirements: { summary: "需要重签安装验证和本地算法" },
  boundaries: { summary: "授权本地样本" },
  completionCriteria: [
    "重签 APK 冷启动和核心路径无回归",
    "Python 对不同输入实时计算且不调用原 SO 或 RPC"
  ]
});
const compositeInit = spawnSync(process.execPath, ["tools/task/task-init.mjs", "natural-composite", `--task-input=${compositeInputPath}`], {
  cwd: repoRoot,
  env: { ...process.env, ANDROID_REVERSE_WORKSPACE_ROOT: tempRoot },
  encoding: "utf8"
});
if (compositeInit.status !== 0) {
  findings.push(`task-init should create a natural composite task: ${(compositeInit.stderr || compositeInit.stdout || "").trim()}`);
} else {
  const taskPath = path.join(tempRoot, "artifacts", "tasks", "natural-composite", "task.json");
  const task = JSON.parse(fs.readFileSync(taskPath, "utf8"));
  const tiers = new Set((task.deliverables || []).map((item) => item.tier));
  if (!tiers.has("T3") || !tiers.has("T5") || task.deliverables.length !== 2) {
    findings.push("natural composite objectives must produce separate T3 and T5 deliverables");
  }
}

const legacyMigrationDir = makeTask("legacy-migration", {
  schemaVersion: 1,
  deliverables: undefined,
  currentDeliverableId: undefined,
  completionCriteria: ["[x] legacy canonical criterion"],
  successCriteria: ["legacy alias must not merge"]
});
const legacyTaskPath = path.join(legacyMigrationDir, "task.json");
const beforeDryRun = fs.readFileSync(legacyTaskPath, "utf8");
const migrationDryRun = spawnSync(process.execPath, ["tools/task/task-migrate.mjs", legacyMigrationDir, "--to=2", "--dry-run"], {
  cwd: repoRoot,
  env: { ...process.env, ANDROID_REVERSE_WORKSPACE_ROOT: tempRoot },
  encoding: "utf8"
});
if (migrationDryRun.status !== 0 || fs.readFileSync(legacyTaskPath, "utf8") !== beforeDryRun) {
  findings.push("task-migrate --dry-run must succeed without changing the legacy task");
}
const migrationApply = spawnSync(process.execPath, ["tools/task/task-migrate.mjs", legacyMigrationDir, "--to=2"], {
  cwd: repoRoot,
  env: { ...process.env, ANDROID_REVERSE_WORKSPACE_ROOT: tempRoot },
  encoding: "utf8"
});
if (migrationApply.status !== 0) {
  findings.push(`task-migrate should apply schema v2 atomically: ${(migrationApply.stderr || migrationApply.stdout || "").trim()}`);
} else {
  const migrated = JSON.parse(fs.readFileSync(legacyTaskPath, "utf8"));
  if (migrated.schemaVersion !== 2 || migrated.completionCriteria.length !== 1 || migrated.deliverables[0]?.status !== "acceptance-ready") {
    findings.push("legacy migration must keep canonical criteria only and must not auto-promote to delivered");
  }
  const backupPath = path.join(legacyMigrationDir, "task.json.v1.bak");
  if (!fs.existsSync(backupPath)) {
    findings.push("legacy migration must create task.json.v1.bak");
  } else {
    cleanupTaskArtifacts(legacyMigrationDir);
    if (!fs.existsSync(backupPath)) {
      findings.push("task cleanup must preserve the schema migration backup");
    }
  }
}

failWith(findings, "check-repair-regressions");
