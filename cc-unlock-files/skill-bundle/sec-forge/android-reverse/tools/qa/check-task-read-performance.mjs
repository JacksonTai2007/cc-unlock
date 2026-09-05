import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { copyCoreTaskScaffold, readTaskJson, taskFile, writeTaskJson } from "../task/common.mjs";
import { failWith } from "./common.mjs";

const findings = [];
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "android-reverse-read-perf-"));
const taskDir = path.join(tempRoot, "artifacts", "tasks", "read-perf");

copyCoreTaskScaffold(taskDir);
const task = readTaskJson(taskDir);
task.taskId = "read-perf";
task.taskPacks.selectedTopics = [
  "static-triage",
  "jni-bridge",
  "native-network",
  "runtime-hooking",
  "protection-bypass"
];
writeTaskJson(taskDir, task);

const before = fs.readFileSync(taskFile(taskDir, "task.json"), "utf8");
const start = performance.now();
for (let i = 0; i < 5; i += 1) {
  readTaskJson(taskDir);
}
const elapsedMs = performance.now() - start;
const after = fs.readFileSync(taskFile(taskDir, "task.json"), "utf8");

if (elapsedMs > 2000) {
  findings.push(`readTaskJson should stay lightweight; 5 reads took ${elapsedMs.toFixed(0)}ms`);
}

if (before !== after) {
  findings.push("readTaskJson must not mutate task.json or perform implicit coverage sync");
}

failWith(findings, "check-task-read-performance");
