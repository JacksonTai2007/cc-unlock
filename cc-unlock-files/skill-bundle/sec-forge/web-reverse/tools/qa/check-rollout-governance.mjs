import fs from "node:fs";
import path from "node:path";
import { failWith, repoRoot } from "./common.mjs";
import {
  extractSessionPathFromRolloutMarkdown,
  listRepoRolloutFiles,
  resolveRolloutPath
} from "./rollout-targets-lib.mjs";

const taskCommandPatterns = {
  taskStart: /(?:npm\s+run\s+task:start\b|node\s+.*tools[\\/]+task[\\/]+task-start\.mjs\b)/i,
  taskInit: /(?:npm\s+run\s+task:init\b|node\s+.*tools[\\/]+task[\\/]+task-init\.mjs\b)/i,
  taskSync: /(?:npm\s+run\s+task:sync\b|node\s+.*tools[\\/]+task[\\/]+task-sync\.mjs\b)/i,
  taskAdvance: /(?:npm\s+run\s+task:advance\b|node\s+.*tools[\\/]+task[\\/]+task-advance\.mjs\b)/i,
  assertCanReply: /(?:npm\s+run\s+task:assert-can-reply\b|node\s+.*tools[\\/]+task[\\/]+assert-can-reply\.mjs\b)/i,
  assertCanReplyValidated: /(?:npm\s+run\s+task:assert-can-reply\b[^\r\n]*--\s*--require-validated-deliverable|node\s+.*tools[\\/]+task[\\/]+assert-can-reply\.mjs\b[^\r\n]*--require-validated-deliverable)/i
};

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

  return [
    path.join(repoRoot, "tools", "qa", "fixtures", "rollout-governance", "good-rollout.md")
  ];
}

function extractMessageText(payload) {
  return (payload?.content || [])
    .map((part) => String(part?.text || part?.input_text || ""))
    .join("\n")
    .trim();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function extractAssistantMessagesFromMarkdown(markdown) {
  return Array.from(
    String(markdown || "").matchAll(
      /^## assistant\s*\r?\n`[^\n]+`\r?\n\r?\n([\s\S]*?)(?=^## (?:assistant|user)\s*$|$)/gim
    )
  ).map((match) => String(match[1] || "").trim()).filter(Boolean);
}

function extractUserMessagesFromMarkdown(markdown) {
  return Array.from(
    String(markdown || "").matchAll(
      /^## user\s*\r?\n`[^\n]+`\r?\n\r?\n([\s\S]*?)(?=^## (?:assistant|user)\s*$|$)/gim
    )
  ).map((match) => String(match[1] || "").trim()).filter(Boolean);
}

function parseSessionEntries(sessionPath) {
  if (!sessionPath || !fs.existsSync(sessionPath)) {
    return [];
  }
  return readJsonl(sessionPath);
}

function collectSessionData(entries) {
  const assistantMessages = [];
  const userMessages = [];
  const commands = [];
  let sawNonTaskToolWork = false;

  for (const entry of entries) {
    if (entry?.type === "response_item" && entry?.payload?.type === "message") {
      const text = extractMessageText(entry.payload);
      if (!text) {
        continue;
      }
      if (entry.payload.role === "assistant") {
        assistantMessages.push(text);
      }
      if (entry.payload.role === "user") {
        userMessages.push(text);
      }
      continue;
    }

    if (entry?.type === "event_msg" && entry?.payload?.type === "user_message") {
      userMessages.push(String(entry.payload.message || ""));
      continue;
    }

    if (entry?.type === "response_item" && entry?.payload?.type === "function_call") {
      const name = String(entry.payload.name || "");
      if (/shell_command/i.test(name)) {
        try {
          const parsed = JSON.parse(String(entry.payload.arguments || "{}"));
          commands.push(String(parsed.command || ""));
        } catch {
          // ignore malformed arguments
        }
      } else if (!/task-(?:start|init|sync|advance)|assert-can-reply/i.test(name)) {
        sawNonTaskToolWork = true;
      }
      continue;
    }

    if (entry?.type === "event_msg" && entry?.payload?.type === "exec_command_end") {
      const command = Array.isArray(entry.payload.command)
        ? entry.payload.command.join(" ")
        : String(entry.payload.command || "");
      commands.push(command);
      continue;
    }

    if (entry?.type === "event_msg" && entry?.payload?.type === "mcp_tool_call_end") {
      const tool = String(entry.payload?.invocation?.tool || "");
      if (!/task-(?:start|init|sync|advance)|assert-can-reply/i.test(tool)) {
        sawNonTaskToolWork = true;
      }
    }
  }

  return {
    assistantMessages,
    userMessages,
    commands,
    sawNonTaskToolWork
  };
}

function countTaskCommands(commands) {
  const counts = {
    taskStart: 0,
    taskInit: 0,
    taskSync: 0,
    taskAdvance: 0,
    assertCanReply: 0,
    assertCanReplyValidated: 0
  };

  for (const command of commands) {
    for (const [key, pattern] of Object.entries(taskCommandPatterns)) {
      if (pattern.test(command)) {
        counts[key] += 1;
      }
    }
  }

  return counts;
}

function normalizeSlashes(text) {
  return String(text || "").replaceAll("\\", "/");
}

function extractPathsFromMessages(messages) {
  const paths = new Set();
  const pattern = /(?:[A-Za-z]:[\\/][^\s`"'，。；;]+|(?:\.{1,2}[\\/])?[A-Za-z0-9_.-]+(?:[\\/][A-Za-z0-9_.-]+)+)/g;

  for (const message of messages) {
    for (const match of String(message || "").matchAll(pattern)) {
      const candidate = String(match[0] || "").trim();
      if (candidate.includes("://")) {
        continue;
      }
      paths.add(candidate);
    }
  }

  return Array.from(paths);
}

function looksLikeDeliverablePath(candidate) {
  const normalized = normalizeSlashes(candidate).toLowerCase();
  const basename = path.posix.basename(normalized);
  if ([
    "report.md",
    "fixtures.json",
    "verify-once.mjs",
    "verify-once.js",
    "web-replay.js",
    "local-repro-example.js",
    "run-local.mjs",
    "route-state.json",
    "progress.md",
    "clues.md"
  ].includes(basename)) {
    return true;
  }

  if (!/\.(?:json|js|mjs|md)$/i.test(basename)) {
    return false;
  }

  return /(state|replay|verify|fixture|report|search|repro|pure|session|storage|signer)/i.test(basename);
}

function pathIsTaskLocal(candidate) {
  return /artifacts\/tasks\/[^/]+/i.test(normalizeSlashes(candidate));
}

function containsCompletionClaim(text) {
  return /(已成功|已完成|已打通|已交付|已闭环|请求成功|successfully completed|request succeeded)/i.test(String(text || ""));
}

function containsLoginPrompt(text) {
  return /(现在请登录|请先登录|请你登录|请完成登录|please log in now|please login now|please log in)/i.test(String(text || ""));
}

function containsDeviationDisclosure(text) {
  return /(偏差|偏移|目标变更|当前仅|尚未完成|未完成.*a_bogus|只实现了.*x-bogus|需确认改目标|原目标|不是纯算法|不是纯\s*(python|node)|不是最终交付|只到.*(?:poc|browser|playwright)|仅到.*(?:poc|browser|playwright))/i.test(String(text || ""));
}

function hasUserLoginCollabRequest(text) {
  return /(打开后通知我登录|通知我进行登录|通知我登录|notify me.*login|tell me.*login)/i.test(String(text || ""));
}

function containsExplicitCollabPrompt(text) {
  return /(现在请登录|请先登录|请你登录|请完成登录|请加载|回我.?已加载|回我.?已登录|请补样本|requiredUserAction|resumeCondition|replyGateDecision)/i.test(String(text || ""));
}

function containsResumeAcknowledgement(text) {
  return /^(已加载|已登录|继续|好了|完成了|已完成|ok\b|okay\b|可以了|loaded\b|logged in\b)/i.test(String(text || "").trim());
}

function isNewTask(text) {
  return /(这是一个新的|新任务|new web reverse task|this is a new)/i.test(String(text || ""));
}

function containsPureLocalTarget(text) {
  return /((最终目标|目标|交付).{0,120}(python|node(?:js)?).{0,160}(m3u8|ts|解密|请求|下载))|(纯\s*(python|node(?:js)?))|(不依赖[\s\S]{0,40}(playwright|puppeteer|浏览器))/i.test(String(text || ""));
}

function containsBrowserHarnessClaim(text) {
  return /(playwright|puppeteer|browser-controlled|浏览器(?:框架|黑盒|复用|harness)?)/i.test(String(text || ""));
}

function containsOriginalTargetNotDelivered(text) {
  return /(原目标尚未完成|尚未满足原目标|当前仅到.*(?:poc|浏览器|playwright)|还不是最终交付|若坚持纯\s*(python|node)|需继续迁移到纯\s*(python|node))/i.test(String(text || ""));
}

function finalAssistantMessage(messages) {
  return messages.length > 0 ? messages[messages.length - 1] : "";
}

function extractCommandFromEntry(entry) {
  if (entry?.type === "response_item" && entry?.payload?.type === "function_call") {
    const name = String(entry.payload.name || "");
    if (/shell_command/i.test(name)) {
      try {
        const parsed = JSON.parse(String(entry.payload.arguments || "{}"));
        return String(parsed.command || "");
      } catch {
        return "";
      }
    }
    return "";
  }

  if (entry?.type === "event_msg" && entry?.payload?.type === "exec_command_end") {
    return Array.isArray(entry.payload.command)
      ? entry.payload.command.join(" ")
      : String(entry.payload.command || "");
  }

  return "";
}

function extractAssertCanReplyState(output) {
  const text = String(output || "");
  const match = text.match(/assert-can-reply:\s+(OK|BLOCKED)[\s\S]*?execution\.status=([^\r\n]+)/i);
  if (!match) {
    return "";
  }
  return cleanText(match[2]);
}

function analyzeResumeAndGateDiscipline(entries) {
  const findings = [];
  let collaborationPromptSeen = false;
  let resumeSeenAt = "";
  let clearPauseSeenAfterResume = false;
  let lastAssertCanReplyStatus = "";

  for (const entry of entries) {
    const assistantText =
      entry?.type === "response_item" && entry?.payload?.type === "message" && entry?.payload?.role === "assistant"
        ? extractMessageText(entry.payload)
        : entry?.type === "event_msg" && entry?.payload?.type === "agent_message"
          ? String(entry.payload.message || "")
          : "";
    const userText =
      entry?.type === "response_item" && entry?.payload?.type === "message" && entry?.payload?.role === "user"
        ? extractMessageText(entry.payload)
        : entry?.type === "event_msg" && entry?.payload?.type === "user_message"
          ? String(entry.payload.message || "")
          : "";

    if (assistantText && containsExplicitCollabPrompt(assistantText)) {
      collaborationPromptSeen = true;
    }

    if (collaborationPromptSeen && userText && containsResumeAcknowledgement(userText)) {
      resumeSeenAt = entry.timestamp || "(unknown)";
      clearPauseSeenAfterResume = false;
    }

    const command = extractCommandFromEntry(entry);
    if (command) {
      if (/(?:task-advance\.mjs|task:advance)/i.test(command) && /(?:--pause-category=none|--resume-from-user|--clear-pause)/i.test(command)) {
        clearPauseSeenAfterResume = true;
      }
    }

    if (entry?.type === "event_msg" && entry?.payload?.type === "exec_command_end") {
      const status = extractAssertCanReplyState(entry.payload.aggregated_output || "");
      if (status) {
        lastAssertCanReplyStatus = status;
      }
    }

    if (assistantText && containsCompletionClaim(assistantText) && /blocked-on-(user|risk)/i.test(lastAssertCanReplyStatus)) {
      findings.push(`completion claim was emitted while latest assert-can-reply status remained ${lastAssertCanReplyStatus}`);
    }
  }

  if (resumeSeenAt && !clearPauseSeenAfterResume) {
    findings.push(`user acknowledged collaboration completion at ${resumeSeenAt}, but rollout never cleared pause via task-advance --resume-from-user/--pause-category=none`);
  }

  return findings;
}

function analyzeRollout(rolloutPath) {
  const findings = [];
  const rolloutText = fs.readFileSync(rolloutPath, "utf8");
  const sessionPath = extractSessionPathFromRolloutMarkdown(rolloutText, rolloutPath);
  const sessionEntries = parseSessionEntries(sessionPath);
  const sessionData = collectSessionData(sessionEntries);
  const assistantMessages = sessionData.assistantMessages.length > 0
    ? sessionData.assistantMessages
    : extractAssistantMessagesFromMarkdown(rolloutText);
  const userMessages = sessionData.userMessages.length > 0
    ? sessionData.userMessages
    : extractUserMessagesFromMarkdown(rolloutText);
  const lastAssistant = finalAssistantMessage(assistantMessages);
  const allAssistantText = assistantMessages.join("\n\n");
  const allUserText = userMessages.join("\n\n");
  const counts = countTaskCommands(sessionData.commands);
  const assistantPaths = extractPathsFromMessages(assistantMessages);
  const sessionDisciplineFindings = analyzeResumeAndGateDiscipline(sessionEntries);
  findings.push(...sessionDisciplineFindings);

  if (sessionData.sawNonTaskToolWork) {
    if (counts.taskSync === 0) {
      findings.push("session used non-task tools before any recorded task-sync");
    }
    if (counts.taskAdvance === 0) {
      findings.push("session used non-task tools before any recorded task-advance");
    }
  }

  if (isNewTask(allUserText) && counts.taskStart === 0 && counts.taskInit === 0) {
    findings.push("new-task rollout has no recorded task-start/task-init execution");
  }

  const completionClaim = containsCompletionClaim(lastAssistant) || containsCompletionClaim(allAssistantText);
  if (completionClaim && counts.assertCanReply === 0) {
    findings.push("completion claim was made without any recorded assert-can-reply execution");
  }
  if (completionClaim && counts.assertCanReplyValidated === 0) {
    findings.push("completion claim was made without assert-can-reply --require-validated-deliverable");
  }

  const offTaskDeliverables = assistantPaths.filter((candidate) => looksLikeDeliverablePath(candidate) && !pathIsTaskLocal(candidate));
  if (offTaskDeliverables.length > 0) {
    findings.push(`assistant claimed deliverables outside task-local: ${offTaskDeliverables.join(", ")}`);
  }

  if (completionClaim) {
    const mentionedTaskLocalArtifacts = assistantPaths.filter((candidate) => pathIsTaskLocal(candidate));
    if (mentionedTaskLocalArtifacts.length === 0) {
      findings.push("completion claim did not reference any task-local artifact path");
    }
    if (!/report\.md/i.test(allAssistantText)) {
      findings.push("completion claim did not mention report.md");
    }
    if (!/verify-once\.(?:mjs|js)/i.test(allAssistantText)) {
      findings.push("completion claim did not mention run/verify-once.mjs");
    }
    if (!/fixtures\.json/i.test(allAssistantText)) {
      findings.push("completion claim did not mention run/fixtures.json");
    }
    if (!/acceptancePath|验收路径|acceptance path/i.test(allAssistantText)) {
      findings.push("completion claim did not mention an explicit acceptancePath / 验收路径");
    }
  }

  if (completionClaim && containsPureLocalTarget(allUserText) && containsBrowserHarnessClaim(lastAssistant) && !containsOriginalTargetNotDelivered(lastAssistant)) {
    findings.push("assistant stopped on a browser-controlled / Playwright-style delivery while the user target still required pure local Python/Node, but did not clearly state the original target remains unfinished");
  }

  if (hasUserLoginCollabRequest(allUserText) && !containsLoginPrompt(allAssistantText)) {
    findings.push("user requested explicit login collaboration, but assistant never issued a clear '现在请登录' style prompt");
  }

  if (/a_bogus/i.test(allUserText)) {
    const driftPattern = /(a_bogus).*(空 body|空体|失败|fail)[\s\S]{0,200}(x-bogus).*(成功|返回|complete|success)/i;
    if (driftPattern.test(lastAssistant) && !containsDeviationDisclosure(lastAssistant)) {
      findings.push("assistant switched from a_bogus target to X-Bogus success without an explicit deviation statement");
    }
  }

  if (
    /(保存 cookie|保存.*state\.json|会话参数保存到本地|state\.json)/i.test(allAssistantText) &&
    !/(脱敏|redact|哈希|摘要|前后缀|masked)/i.test(allAssistantText)
  ) {
    findings.push("assistant described saving session state locally without an explicit redaction/minimal-snapshot statement");
  }

  return {
    rolloutPath,
    findings
  };
}

function runFixtureSelfContract(findings) {
  const fixtureDir = path.join(repoRoot, "tools", "qa", "fixtures", "rollout-governance");
  for (const fileName of fs.readdirSync(fixtureDir).sort((a, b) => a.localeCompare(b))) {
    if (!fileName.endsWith(".md")) {
      continue;
    }
    const result = analyzeRollout(path.join(fixtureDir, fileName));
    const isGood = /\.good\.md$/i.test(fileName) || fileName === "good-rollout.md";
    const isBad = /\.bad\.md$/i.test(fileName) || /^bad-/i.test(fileName);
    if (isGood && result.findings.length > 0) {
      findings.push(`rollout-governance self-contract failed: good fixture ${fileName} produced findings: ${result.findings.join(" | ")}`);
    }
    if (isBad && result.findings.length === 0) {
      findings.push(`rollout-governance self-contract failed: bad fixture ${fileName} did not trigger any findings`);
    }
  }
}

const findings = [];
runFixtureSelfContract(findings);

for (const rolloutPath of parseTargets()) {
  if (!fs.existsSync(rolloutPath)) {
    findings.push(`missing rollout file: ${rolloutPath.replaceAll("\\", "/")}`);
    continue;
  }
  const result = analyzeRollout(rolloutPath);
  for (const finding of result.findings) {
    findings.push(`${result.rolloutPath.replaceAll("\\", "/")}: ${finding}`);
  }
}

failWith(findings, "check-rollout-governance");
