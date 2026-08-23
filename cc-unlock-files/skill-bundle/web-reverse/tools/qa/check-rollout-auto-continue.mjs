import fs from "node:fs";
import path from "node:path";
import { failWith, repoRoot } from "./common.mjs";
import {
  extractSessionPathFromRolloutMarkdown,
  listRepoRolloutFiles,
  resolveRolloutPath
} from "./rollout-targets-lib.mjs";

const findings = [];
const fixturesDir = path.join(repoRoot, "tools", "qa", "fixtures", "rollouts");
const forbiddenPatterns = [
  "如果你同意",
  "如果你同意继续",
  "如果你愿意",
  "如果你要",
  "我会继续",
  "下一步我将继续",
  "我将自动推进"
];
const forbiddenRegexes = [
  /(?:^|[。；!！\n])\s*如果你(?:愿意|要)[\s\S]{0,80}(?:我(?:下一步)?|下一步)[\s\S]{0,40}(?:就|将|会)(?:直接)?(?:继续|做|跑|迁|推进|重跑|复现)/i,
  /(?:^|[。；!！\n])\s*(?:我(?:下一步)?|下一步)(?:就|将|会)(?:直接)?(?:继续|做|跑|迁|推进|重跑|复现)/i,
  /(?:^|[。；!！\n])\s*接下来(?:就|将)(?:直接)?(?:继续|做|跑|迁|推进|重跑|复现)/i
];
const explicitCollabPausePattern =
  /(现在请登录|请先登录|请你登录|请完成登录|请加载|请回我|回我.?已加载|回我.?已登录|补样本|requiredUserAction|resumeCondition|replyGateDecision)/i;

function parseTargets() {
  const cliTargets = process.argv.slice(2).filter((item) => !item.startsWith("--"));
  const envTargets = String(process.env.WEB_REVERSE_ROLLOUT_TARGETS || "")
    .split(/[;\r\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (cliTargets.length > 0 || envTargets.length > 0) {
    return Array.from(new Set([...cliTargets, ...envTargets])).map((target) => resolveRolloutPath(target));
  }

  const repoRollouts = listRepoRolloutFiles().filter((rolloutPath) => {
    const text = fs.readFileSync(rolloutPath, "utf8");
    return !/rollout-governance:\s*archived-known-bad/i.test(text);
  });
  if (repoRollouts.length > 0) {
    return repoRollouts;
  }

  return [];
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function extractAssistantText(entry) {
  if (entry?.type === "response_item" && entry?.payload?.type === "message" && entry?.payload?.role === "assistant") {
    return (entry.payload.content || [])
      .map((part) => String(part?.text || ""))
      .join("\n");
  }
  if (entry?.type === "event_msg" && entry?.payload?.type === "agent_message") {
    return String(entry.payload.message || "");
  }
  return "";
}

function isToolActivity(entry) {
  return (
    (entry?.type === "response_item" &&
      (entry?.payload?.type === "function_call" || entry?.payload?.type === "function_call_output")) ||
    (entry?.type === "event_msg" &&
      ["mcp_tool_call_end", "exec_command_end"].includes(String(entry?.payload?.type || "")))
  );
}

function detectPromiseStop(entries) {
  const hits = [];
  let pending = null;

  for (const entry of entries) {
    const assistantText = extractAssistantText(entry);
    if (assistantText) {
      const matched = forbiddenPatterns.filter((pattern) => assistantText.includes(pattern));
      const regexMatched = forbiddenRegexes.filter((pattern) => pattern.test(assistantText)).map((pattern) => pattern.toString());
      if ((matched.length > 0 || regexMatched.length > 0) && !explicitCollabPausePattern.test(assistantText)) {
        pending = {
          timestamp: entry.timestamp || "",
          matched: [...matched, ...regexMatched],
          preview: assistantText.replace(/\s+/g, " ").trim().slice(0, 220)
        };
      } else {
        pending = null;
      }
      continue;
    }

    if (!pending) {
      continue;
    }

    if (isToolActivity(entry)) {
      pending = null;
      continue;
    }

    if (entry?.type === "event_msg" && entry?.payload?.type === "task_complete") {
      hits.push({
        ...pending,
        completedAt: entry.timestamp || ""
      });
      pending = null;
    }
  }

  if (pending) {
    hits.push({
      ...pending,
      completedAt: "(eof)"
    });
  }

  return hits;
}

function analyzeSessionFile(filePath, shouldFail = null) {
  const entries = readJsonl(filePath);
  const hits = detectPromiseStop(entries);
  const fileName = path.basename(filePath);

  if (shouldFail === true && hits.length === 0) {
    findings.push(`${fileName} 应该命中“口头承诺继续后直接停下”检测，但未命中`);
    return;
  }

  if (shouldFail === false && hits.length > 0) {
    findings.push(`${fileName} 不应命中检测，但命中了 ${hits.length} 次`);
    return;
  }

  if (shouldFail == null && hits.length > 0) {
    for (const hit of hits) {
      findings.push(
        `${filePath.replaceAll("\\", "/")} 命中“口头承诺继续后直接停下”：${hit.preview}`
      );
    }
  }
}

for (const fileName of fs.readdirSync(fixturesDir).sort((a, b) => a.localeCompare(b))) {
  const filePath = path.join(fixturesDir, fileName);
  analyzeSessionFile(filePath, fileName.endsWith(".bad.jsonl"));
}

for (const target of parseTargets()) {
  if (!fs.existsSync(target)) {
    findings.push(`missing rollout/session file: ${target.replaceAll("\\", "/")}`);
    continue;
  }

  if (/\.jsonl$/i.test(target)) {
    analyzeSessionFile(target);
    continue;
  }

  const markdown = fs.readFileSync(target, "utf8");
  const sessionPath = extractSessionPathFromRolloutMarkdown(markdown, target);
  if (!sessionPath) {
    findings.push(`${target.replaceAll("\\", "/")} 缺少会话 jsonl 引用，无法校验 auto-continue`);
    continue;
  }
  if (!fs.existsSync(sessionPath)) {
    findings.push(`${target.replaceAll("\\", "/")} 引用的会话文件不存在: ${sessionPath.replaceAll("\\", "/")}`);
    continue;
  }

  analyzeSessionFile(sessionPath);
}

failWith(findings, "check-rollout-auto-continue");
