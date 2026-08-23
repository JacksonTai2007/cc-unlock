import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { failWith, repoRoot } from "./common.mjs";
import { discoverRolloutTaskTargets } from "./rollout-targets-lib.mjs";
import { ensureTaskRuntimeShape, readTaskJson, resolveTaskDir, taskFile } from "../task/common.mjs";
import { evaluateDeliveryAuthenticity } from "../task/validation.mjs";

function parseTargets() {
  const cliTargets = process.argv.slice(2).filter((item) => !item.startsWith("--"));
  const envTargets = String(process.env.WEB_REVERSE_REAL_TASK_TARGETS || "")
    .split(/[;\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const defaultTargets = [
    path.join("artifacts", "tasks", "seed-campaign-20260415-01-signature-instrumentation-session-storage")
  ].filter((target) => fs.existsSync(path.join(repoRoot, target, "task.json")));
  const rolloutTargets = discoverRolloutTaskTargets();
  return Array.from(new Set([...defaultTargets, ...rolloutTargets, ...cliTargets, ...envTargets]));
}

function runFixtureSelfContract(findings) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "web-reverse-delivery-auth-"));
  try {
    const makeTask = (taskId) => {
      const task = ensureTaskRuntimeShape({
        taskId,
        deliveryRequirements: {
          localReproductionRequested: true,
          apiCallExampleRequired: true
        }
      });
      task.__taskDir = path.join(tempRoot, taskId);
      fs.mkdirSync(path.join(task.__taskDir, "run"), { recursive: true });
      return task;
    };

    const goodTask = makeTask("good");
    fs.writeFileSync(
      taskFile(goodTask.__taskDir, "run/web-replay.js"),
      [
        "const signedUrl = new URL('https://example.test/api');",
        "signedUrl.searchParams.set('a_bogus', aBogus);",
        "signedUrl.searchParams.set('X-Bogus', xBogus);",
        "signedUrl.searchParams.set('_signature', signature);",
        "await doRequest({ signedUrl: signedUrl.toString() });"
      ].join("\n")
    );
    fs.writeFileSync(taskFile(goodTask.__taskDir, "run/local-repro-example.js"), "console.log('ok');\n");
    const goodFindings = [];
    evaluateDeliveryAuthenticity(goodTask, goodFindings);
    if (goodFindings.length > 0) {
      findings.push(`delivery-authenticity self-contract failed: good fixture produced findings: ${goodFindings.join(" | ")}`);
    }

    const badTask = makeTask("bad");
    fs.writeFileSync(
      taskFile(badTask.__taskDir, "run/web-replay.js"),
      [
        "const aBogus = makeABogus();",
        "const xBogus = makeXBogus();",
        "const signature = makeSignature();",
        "// verify_check fallback to saved successful json",
        "const cached = await fs.promises.readFile('live-browser-response-body.txt', 'utf8');",
        "console.log('unused params', { aBogus, xBogus, signature, cached });"
      ].join("\n")
    );
    fs.writeFileSync(taskFile(badTask.__taskDir, "run/local-repro-example.js"), "console.log('bad');\n");
    const badFindings = [];
    evaluateDeliveryAuthenticity(badTask, badFindings);
    if (badFindings.length === 0) {
      findings.push("delivery-authenticity self-contract failed: bad fixture did not trigger any findings");
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

const findings = [];
const targets = parseTargets();
runFixtureSelfContract(findings);

for (const target of targets) {
  const taskDir = resolveTaskDir(target);
  const label = path.resolve(taskDir).replaceAll("\\", "/");
  if (!fs.existsSync(taskFile(taskDir, "task.json"))) {
    findings.push(`[${label}] missing task.json`);
    continue;
  }

  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  task.__taskDir = taskDir;
  const taskFindings = [];
  evaluateDeliveryAuthenticity(task, taskFindings);
  for (const finding of taskFindings) {
    findings.push(`[${label}] ${finding}`);
  }
}

failWith(findings, "check-delivery-authenticity");
