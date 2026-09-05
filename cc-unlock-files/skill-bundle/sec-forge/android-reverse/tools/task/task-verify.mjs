import { relFromRepo, resolveTaskDir } from "./common.mjs";
import { runVerification } from "./verification.mjs";

const taskRef = process.argv[2];
if (!taskRef) {
  console.error("usage: node tools/task/task-verify.mjs <task-id|task-path>");
  process.exit(1);
}

const taskDir = resolveTaskDir(taskRef);
const result = runVerification(taskDir);
if (!result.ok) {
  console.error(`task-verify: FAILED ${relFromRepo(taskDir)}`);
  for (const error of result.errors || []) {
    console.error(`- ${error}`);
  }
  for (const item of result.cases || []) {
    if (!item.ok) {
      console.error(`- ${item.id}: ${item.errors.join("; ")}`);
    }
  }
  process.exit(1);
}

console.log(`task-verify: passed ${relFromRepo(taskDir)} (${result.cases.length} cases)`);
