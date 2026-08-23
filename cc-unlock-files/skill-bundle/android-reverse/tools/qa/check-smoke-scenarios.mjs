import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { repoRoot } from "./common.mjs";
import { smokeScenarios } from "./smoke-scenarios.mjs";

const quickScenarioIds = [
  "login-jni-native-network",
  "webview-storage-smali"
];

function runNode(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8"
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`command failed: node ${args.join(" ")}`);
  }
}

function snapshotTree(rootDir) {
  const snapshot = new Map();
  const walk = (dirPath) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        snapshot.set(path.relative(rootDir, fullPath), fs.readFileSync(fullPath).toString("base64"));
      }
    }
  };
  walk(rootDir);
  return snapshot;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const quick = args.includes("--quick");
  const scenarioIds = args
    .filter((item) => item.startsWith("--scenario="))
    .map((item) => String(item.split("=")[1] || "").trim())
    .filter(Boolean);

  const selectedIds = scenarioIds.length > 0
    ? scenarioIds
    : (quick ? quickScenarioIds : []);
  const scenarios = selectedIds.length > 0
    ? selectedIds.map((id) => {
        const scenario = smokeScenarios.find((item) => item.id === id);
        if (!scenario) {
          throw new Error(`unknown smoke scenario: ${id}`);
        }
        return scenario;
      })
    : smokeScenarios;

  return {
    quick,
    scenarios
  };
}

function main() {
  const { quick, scenarios } = parseArgs(process.argv);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "android-reverse-smoke-"));
  const tempRepo = path.join(tempRoot, "repo");
  const codexHome = path.join(tempRoot, ".codex-home");
  const env = {
    ...process.env,
    CODEX_HOME: codexHome,
    HOME: tempRoot,
    USERPROFILE: tempRoot
  };

  fs.cpSync(repoRoot, tempRepo, {
    recursive: true
  });

  for (const [index, scenario] of scenarios.entries()) {
    const startArgs = [
      "tools/task/task-start.mjs",
      scenario.taskId,
      `--task-input=${scenario.taskInput}`,
      ...(index > 0 ? ["--force-new-task"] : []),
      ...scenario.initArgs
    ];
    runNode(startArgs, {
      cwd: tempRepo,
      env
    });
    runNode(["tools/task/task-sync.mjs", scenario.taskId], {
      cwd: tempRepo,
      env
    });
    runNode(["tools/qa/apply-smoke-scenario.mjs", scenario.id, scenario.taskId], {
      cwd: tempRepo,
      env
    });
    runNode([`artifacts/tasks/${scenario.taskId}/run/verify-once.mjs`, "--validate-only"], {
      cwd: tempRepo,
      env
    });
    runNode(["tools/task/task-close.mjs", scenario.taskId], {
      cwd: tempRepo,
      env
    });
    const taskDir = path.join(tempRepo, "artifacts", "tasks", scenario.taskId);
    const canonicalFiles = [
      "task.json",
      "report.md",
      "state/route-state.json",
      "state/route-plan.md",
      "state/progress.md",
      "state/clues.md"
    ];
    const beforeSecondClose = new Map(
      canonicalFiles.map((relPath) => [relPath, fs.readFileSync(path.join(taskDir, relPath), "utf8")])
    );
    const beforeSecondCloseTree = snapshotTree(taskDir);
    runNode(["tools/task/task-close.mjs", scenario.taskId], {
      cwd: tempRepo,
      env
    });
    for (const relPath of canonicalFiles) {
      const after = fs.readFileSync(path.join(taskDir, relPath), "utf8");
      if (after !== beforeSecondClose.get(relPath)) {
        throw new Error(`task-close must be idempotent for ${scenario.id}: ${relPath} changed on the second close`);
      }
    }
    const afterSecondCloseTree = snapshotTree(taskDir);
    const treeEntries = (snapshot) => Array.from(snapshot.entries()).sort(([left], [right]) => left.localeCompare(right));
    if (JSON.stringify(treeEntries(afterSecondCloseTree)) !== JSON.stringify(treeEntries(beforeSecondCloseTree))) {
      throw new Error(`task-close must not add, remove, or rewrite task files on the second close: ${scenario.id}`);
    }
  }

  console.log(`check-smoke-scenarios: OK (${scenarios.length} scenarios${quick ? ", quick" : ""})`);
}

main();
