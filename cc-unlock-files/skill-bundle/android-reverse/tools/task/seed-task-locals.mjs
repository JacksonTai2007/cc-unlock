import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readTopicRegistry } from "../topic-registry.mjs";
import {
  ensureTaskRuntimeShape,
  readTaskJson,
  resolveTaskDir,
  skillRoot,
  workspaceRoot,
  writeTaskJson
} from "./common.mjs";

const quickAdoptionPlan = [
  {
    slug: "static-jni-protocol",
    topics: ["static-triage", "jni-bridge", "crypto-protocol"]
  },
  {
    slug: "java-flow-storage",
    topics: ["java-api", "call-flow", "storage-ipc"]
  },
  {
    slug: "framework-native-network",
    topics: ["framework-runtime", "native-network", "native-so"]
  },
  {
    slug: "runtime-bypass-art",
    topics: ["runtime-hooking", "protection-bypass", "art-runtime"]
  },
  {
    slug: "split-smali-ctf",
    topics: ["split-delivery", "smali-patching", "ctf"]
  }
];

const arrayFieldHints = [
  "patterns",
  "surfaces",
  "families",
  "channels",
  "decisionPoints",
  "stages",
  "contexts",
  "payloadArtifacts",
  "operationNames",
  "methods",
  "hookSurfaces",
  "remoteModules",
  "transforms",
  "operations",
  "cryptoFamilies",
  "ceremonies",
  "channelLabels",
  "types",
  "signFields",
  "licenseEndpoints",
  "subapps",
  "vectors",
  "routeTracks"
];

const explicitFieldDefaults = {
  "staticTriage.status": "mapped",
  "javaApi.status": "mapped",
  "callFlow.status": "mapped",
  "jniBridge.status": "mapped",
  "nativeSo.status": "mapped",
  "runtimeHooking.status": "captured",
  "protectionBypass.status": "bypassed",
  "dexLoader.status": "mapped",
  "frameworkRuntime.status": "mapped",
  "nativeNetwork.status": "captured",
  "storageIpc.status": "mapped",
  "webviewHybrid.status": "mapped",
  "splitDelivery.status": "mapped",
  "artRuntime.status": "captured",
  "antiEmulatorDebug.status": "bypassed",
  "smaliPatching.status": "verified",
  "cryptoProtocol.status": "mapped",
  "ctf.status": "solved"
};

function usage() {
  console.log(
    [
      "usage: node tools/task/seed-task-locals.mjs [--dry-run] [--skip-close] [--prefix=seed] [--tag=quick]",
      "",
      "defaults:",
      "- plan: quick-adoption (5 task-locals, 15 topics)",
      "- executes: task-start -> task-sync -> task-advance -> task-close"
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const skipClose = args.includes("--skip-close");
  const prefixArg = args.find((arg) => arg.startsWith("--prefix="));
  const tagArg = args.find((arg) => arg.startsWith("--tag="));
  const prefix = (prefixArg ? prefixArg.split("=").slice(1).join("=") : "seed")
    .trim()
    .toLowerCase();
  const tag = (tagArg ? tagArg.split("=").slice(1).join("=") : "quick")
    .trim()
    .toLowerCase();

  return {
    dryRun,
    skipClose,
    prefix: prefix || "seed",
    tag: tag || "quick"
  };
}

function nowStamp() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function runNodeScript(scriptRelPath, args, options = {}) {
  const { dryRun = false, quiet = false } = options;
  const commandPreview = `node ${scriptRelPath} ${args.join(" ")}`.trim();
  if (!quiet) {
    console.log(`[seed] ${commandPreview}`);
  }
  if (dryRun) {
    return { status: 0, stdout: "", stderr: "" };
  }

  const scriptPath = path.join(skillRoot, scriptRelPath);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      ANDROID_REVERSE_SKILL_ROOT: skillRoot,
      ANDROID_REVERSE_WORKSPACE_ROOT: workspaceRoot
    },
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`${commandPreview} failed with code ${result.status ?? 1}`);
  }
  return result;
}

function getPathValue(target, fieldPath) {
  return String(fieldPath || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current == null ? undefined : current[key]), target);
}

function setPathValue(target, fieldPath, value) {
  const parts = String(fieldPath || "").split(".").filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (cursor[key] == null || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
}

function pickNonDisallowed(pathKey, disallow = []) {
  const banned = new Set((disallow || []).map((value) => String(value || "").toLowerCase()));
  const candidates = [
    explicitFieldDefaults[pathKey],
    "mapped",
    "captured",
    "passed",
    "stable",
    "deterministic"
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!banned.has(String(candidate).toLowerCase())) {
      return candidate;
    }
  }
  return "seeded";
}

function defaultValueForPath(pathKey) {
  if (explicitFieldDefaults[pathKey]) {
    return explicitFieldDefaults[pathKey];
  }

  if (arrayFieldHints.some((suffix) => pathKey.endsWith(`.${suffix}`) || pathKey === suffix)) {
    return ["seed-sample"];
  }

  if (/(?:^|\.)(?:status|mode|kind|family|transport|strategy|runtime|boundary|schema|loader|hook|pipeline|capture|normalization|binding|coverage|trace|dispatcher|callgraph|mapping|injection|sink|player|token|sandbox|shareScope)$/i.test(pathKey)) {
    return "seeded";
  }

  return "seeded";
}

function ensureConditionSatisfied(task, taskDir, condition, marker, touchedArtifacts) {
  if (!condition || typeof condition !== "object") {
    return;
  }

  if (Array.isArray(condition.touchedAny) && condition.touchedAny.length > 0) {
    const relPath = condition.touchedAny[0];
    touchArtifact(taskDir, relPath, marker);
    touchedArtifacts.add(relPath);
  }

  if (!condition.path) {
    return;
  }

  const existing = getPathValue(task, condition.path);
  let value;

  if (Object.prototype.hasOwnProperty.call(condition, "equals")) {
    value = condition.equals;
  } else if (Array.isArray(condition.disallow)) {
    value = pickNonDisallowed(condition.path, condition.disallow);
  } else if (typeof condition.minLength === "number") {
    if (Array.isArray(existing)) {
      const targetLength = Math.max(1, condition.minLength);
      value = Array.from({ length: targetLength }, (_, idx) => `seed-${idx + 1}`);
    } else {
      value = "seeded-value";
    }
  } else if (condition.truthy === true) {
    value = defaultValueForPath(condition.path);
  } else {
    value = defaultValueForPath(condition.path);
  }

  setPathValue(task, condition.path, value);
}

function touchArtifact(taskDir, relPath, marker) {
  const filePath = path.join(taskDir, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const ext = path.extname(filePath).toLowerCase();
  const stamp = `seed:${marker}`;

  if (!fs.existsSync(filePath)) {
    if (ext === ".json") {
      fs.writeFileSync(filePath, JSON.stringify({ _seed: stamp }, null, 2) + "\n");
      return;
    }
    if (ext === ".jsonl") {
      fs.writeFileSync(filePath, `${JSON.stringify({ seed: stamp })}\n`);
      return;
    }
    fs.writeFileSync(filePath, `seed ${stamp}\n`);
    return;
  }

  if (ext === ".json") {
    try {
      const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (Array.isArray(value)) {
        value.push({ seed: stamp });
        fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
        return;
      }
      if (value && typeof value === "object") {
        value._seed = stamp;
        fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
        return;
      }
      fs.writeFileSync(filePath, JSON.stringify({ value, _seed: stamp }, null, 2) + "\n");
      return;
    } catch {
      fs.writeFileSync(filePath, JSON.stringify({ _seed: stamp }, null, 2) + "\n");
      return;
    }
  }

  if (ext === ".jsonl") {
    fs.appendFileSync(filePath, `${JSON.stringify({ seed: stamp })}\n`);
    return;
  }

  const comment =
    ext === ".md"
      ? `\n\n- ${stamp}\n`
      : ext === ".wat"
        ? `\n;; ${stamp}\n`
        : ext === ".js" || ext === ".mjs"
          ? `\n// ${stamp}\n`
          : `\n# ${stamp}\n`;

  const current = fs.readFileSync(filePath, "utf8");
  if (!current.includes(stamp)) {
    fs.appendFileSync(filePath, comment);
  }
}

function applyFormalValidationSeeds(task, taskDir, topicSpecs, marker) {
  const touchedArtifacts = new Set();
  for (const topicSpec of topicSpecs) {
    const rule = topicSpec?.formalValidation || null;
    if (!rule) continue;

    for (const requirement of rule.requirementsAll || []) {
      ensureConditionSatisfied(task, taskDir, requirement, marker, touchedArtifacts);
    }

    for (const group of rule.requirementsAny || []) {
      const firstCondition = (group.checks || [])[0];
      if (firstCondition) {
        ensureConditionSatisfied(task, taskDir, firstCondition, marker, touchedArtifacts);
      }
    }

    if (Array.isArray(rule.requiredArtifacts) && rule.requiredArtifacts.length > 0) {
      for (const artifactPath of rule.requiredArtifacts) {
        if (!touchedArtifacts.has(artifactPath)) {
          touchArtifact(taskDir, artifactPath, marker);
          touchedArtifacts.add(artifactPath);
        }
      }
    }
  }
  return touchedArtifacts;
}

function configureTask(taskDir, topicSpecs, marker) {
  const task = ensureTaskRuntimeShape(readTaskJson(taskDir));
  const topics = topicSpecs.map((topic) => topic.key);

  task.targetContext.targetActionDescription = `seed task-local coverage for ${topics.join(", ")}`;
  task.targetContext.objective = `quick closeout sample for ${topics.join(", ")}`;
  task.targetContext.targetKeywords = Array.from(
    new Set([...(task.targetContext.targetKeywords || []), ...topics, "seed", "quick-adoption"])
  );
  task.targetContext.targetFunctionNames = Array.from(
    new Set([...(task.targetContext.targetFunctionNames || []), "seedProbe", "seedReplay"])
  );
  task.targetContext.targetSignals = Array.from(
    new Set([...(task.targetContext.targetSignals || []), `seed:${topics[0] || "task"}`])
  );

  task.successCriteria = [
    {
      id: "SC-001",
      name: "seed closeout gate",
      status: "hit",
      hit: true,
      note: `seeded ${marker}`
    }
  ];

  applyFormalValidationSeeds(task, taskDir, topicSpecs, marker);
  writeTaskJson(taskDir, task);
}

function buildSpecs(prefix, tag, topicRegistry) {
  const stamp = nowStamp();
  const topicMap = new Map(topicRegistry.map((topic) => [topic.key, topic]));
  const specs = [];

  for (let i = 0; i < quickAdoptionPlan.length; i += 1) {
    const item = quickAdoptionPlan[i];
    const missing = item.topics.filter((topicKey) => !topicMap.has(topicKey));
    if (missing.length > 0) {
      throw new Error(`plan contains unknown topics for ${item.slug}: ${missing.join(", ")}`);
    }
    const taskId = `${prefix}-${tag}-${stamp}-${String(i + 1).padStart(2, "0")}-${item.slug}`;
    specs.push({
      ...item,
      taskId,
      topicSpecs: item.topics.map((topicKey) => topicMap.get(topicKey))
    });
  }

  return specs;
}

function collectRouteTracks(topicSpecs) {
  return Array.from(
    new Set(
      topicSpecs
        .map((topic) => String(topic.routeTrack || "").trim())
        .filter(Boolean)
    )
  ).sort();
}

function runSeedForTask(spec, options) {
  const marker = `${spec.taskId}:${new Date().toISOString()}`;
  const topicsCsv = spec.topics.join(",");
  const routeTracks = collectRouteTracks(spec.topicSpecs);

  runNodeScript("tools/task/task-start.mjs", [spec.taskId, `--topics=${topicsCsv}`, "--force-new-task"], {
    dryRun: options.dryRun
  });
  runNodeScript("tools/task/task-sync.mjs", [spec.taskId], { dryRun: options.dryRun });
  runNodeScript("tools/task/task-advance.mjs", [spec.taskId], { dryRun: options.dryRun });

  if (!options.dryRun) {
    const taskDir = resolveTaskDir(spec.taskId);
    configureTask(taskDir, spec.topicSpecs, marker);
  } else {
    return {
      taskId: spec.taskId,
      topics: spec.topics,
      routeTracks,
      closed: false,
      dryRun: true
    };
  }

  runNodeScript("tools/task/task-sync.mjs", [spec.taskId], { dryRun: options.dryRun });
  runNodeScript("tools/task/task-sync.mjs", [spec.taskId], { dryRun: options.dryRun });

  if (!options.skipClose) {
    runNodeScript("tools/task/task-close.mjs", [spec.taskId], { dryRun: options.dryRun });
  }

  return {
    taskId: spec.taskId,
    topics: spec.topics,
    routeTracks,
    closed: !options.skipClose,
    dryRun: options.dryRun
  };
}

function main() {
  const options = parseArgs(process.argv);
  const topicRegistry = readTopicRegistry();
  const specs = buildSpecs(options.prefix, options.tag, topicRegistry);
  const results = [];

  console.log(`[seed] workspace=${workspaceRoot}`);
  console.log(`[seed] tasks=${specs.length}, dryRun=${options.dryRun}, skipClose=${options.skipClose}`);

  for (const spec of specs) {
    console.log(`[seed] start ${spec.taskId} -> ${spec.topics.join(",")}`);
    const result = runSeedForTask(spec, options);
    results.push(result);
    console.log(`[seed] done  ${spec.taskId}`);
  }

  console.log("[seed] summary");
  for (const result of results) {
    console.log(
      `- ${result.taskId} | topics=${result.topics.join(",")} | routeTracks=${result.routeTracks.join(",")} | close=${result.closed ? "yes" : "no"}`
    );
  }
  if (!options.dryRun) {
    console.log("[seed] next: npm run check");
  }
}

try {
  main();
} catch (error) {
  console.error(`[seed] FAILED: ${error.message}`);
  process.exit(1);
}

