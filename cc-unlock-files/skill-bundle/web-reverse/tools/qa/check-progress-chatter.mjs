import fs from "node:fs";
import path from "node:path";
import { failWith, repoRoot } from "./common.mjs";
import { listRepoRolloutFiles } from "./rollout-targets-lib.mjs";

const chatterStartPattern =
  /^(我(?:继续|先|再|直接|马上|现在|看下|回到|转测|切到)|先|现在|接下来|下一步|再回到|我再直接|已继续|已恢复|继续中)/;
const planVerbPattern =
  /查看|追|切到|转测|回到|看下|直接|先把|先确认|确认一下|继续|运行时读|全局搜|拉下来|格式化|缩小到|定位/i;
const resultHintPattern =
  /已经|已拿到|已确认|确认(?:到|出|存在|命中)|发现|命中|失败|成功|证据|结果|通过|可用|暴露|出现|关键新证据|打印|输出|返回|补出/i;
const continuationHandwavePattern =
  /^(?:已继续|继续中|已恢复|继续这个|接着继续|继续推进|先继续|我先继续|已转到|回到这个任务|已经回到这个任务)/i;
const concreteEvidencePattern =
  /确认|发现|命中|拿到|定位|写入|落盘|生成|返回|输出|打印|更新|保存|完成了|已完成/i;

function parseTargets() {
  const cliTargets = process.argv.slice(2).filter((item) => !item.startsWith("--"));
  const envTargets = String(process.env.WEB_REVERSE_ROLLOUT_TARGETS || "")
    .split(/[;\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (cliTargets.length > 0 || envTargets.length > 0) {
    return Array.from(new Set([...cliTargets, ...envTargets]));
  }

  const repoRollouts = listRepoRolloutFiles()
    .filter((rolloutPath) => {
      const text = fs.readFileSync(rolloutPath, "utf8");
      return !/rollout-governance:\s*archived-known-bad/i.test(text);
    })
    .map((rolloutPath) => path.relative(repoRoot, rolloutPath).replaceAll("\\", "/"));

  if (repoRollouts.length > 0) {
    return Array.from(new Set(repoRollouts));
  }

  return [
    path.join("tools", "qa", "fixtures", "progress-chatter", "continued.good.md")
  ];
}

function resolveRolloutPath(target) {
  if (path.isAbsolute(target)) {
    return target;
  }
  return path.join(repoRoot, target);
}

function extractAssistantMessages(markdown) {
  const matches = Array.from(
    String(markdown || "").matchAll(
      /^## assistant\s*\r?\n`[^\n]+`\r?\n\r?\n([\s\S]*?)(?=^## (?:assistant|user)\s*$|$)/gim
    )
  );
  return matches.map((match) => match[1].trim()).filter(Boolean);
}

function isLowSignalMessage(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1) {
    return false;
  }
  const line = lines[0];
  if (line.length > 130) {
    return false;
  }
  if (!chatterStartPattern.test(line)) {
    return false;
  }
  if (!planVerbPattern.test(line)) {
    return false;
  }
  if (continuationHandwavePattern.test(line) && !concreteEvidencePattern.test(line)) {
    return true;
  }
  if (resultHintPattern.test(line)) {
    return false;
  }
  return true;
}

function analyzeRolloutText(markdown) {
  const messages = extractAssistantMessages(markdown);
  let streak = 0;
  let maxStreak = 0;
  let lowSignalCount = 0;
  for (const message of messages) {
    if (isLowSignalMessage(message)) {
      streak += 1;
      lowSignalCount += 1;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }
  return {
    lowSignalCount,
    maxStreak,
    flagged: lowSignalCount >= 4 || maxStreak >= 3
  };
}

function runFixtureSelfContract(findings) {
  const goodFixture = resolveRolloutPath(path.join("tools", "qa", "fixtures", "progress-chatter", "continued.good.md"));
  const badFixture = resolveRolloutPath(path.join("tools", "qa", "fixtures", "progress-chatter", "promise-stop.bad.md"));

  if (!fs.existsSync(goodFixture)) {
    findings.push(`missing progress-chatter fixture: ${goodFixture.replaceAll("\\", "/")}`);
    return;
  }
  if (!fs.existsSync(badFixture)) {
    findings.push(`missing progress-chatter fixture: ${badFixture.replaceAll("\\", "/")}`);
    return;
  }

  const goodAnalysis = analyzeRolloutText(fs.readFileSync(goodFixture, "utf8"));
  if (goodAnalysis.flagged) {
    findings.push("progress-chatter self-contract failed: good fixture was incorrectly flagged");
  }

  const badAnalysis = analyzeRolloutText(fs.readFileSync(badFixture, "utf8"));
  if (!badAnalysis.flagged) {
    findings.push("progress-chatter self-contract failed: bad fixture did not trigger low-signal chatter detection");
  }
}

const findings = [];
const targets = parseTargets();
runFixtureSelfContract(findings);

for (const target of targets) {
  const rolloutPath = resolveRolloutPath(target);
  if (!fs.existsSync(rolloutPath)) {
    findings.push(`missing rollout file: ${rolloutPath.replaceAll("\\", "/")}`);
    continue;
  }

  const { lowSignalCount, maxStreak, flagged } = analyzeRolloutText(fs.readFileSync(rolloutPath, "utf8"));

  if (flagged) {
    findings.push(
      `${rolloutPath.replaceAll("\\", "/")} contains excessive low-signal assistant chatter: lowSignalCount=${lowSignalCount}, maxStreak=${maxStreak}`
    );
  }
}

failWith(findings, "check-progress-chatter");
