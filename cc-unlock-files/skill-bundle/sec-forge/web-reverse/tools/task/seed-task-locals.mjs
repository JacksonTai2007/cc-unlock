import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readTopicRegistry } from "../topic-registry.mjs";
import {
  ensureTaskRuntimeShape,
  readTaskJson,
  relFromRepo,
  resolveTaskDir,
  skillRoot,
  workspaceRoot,
  writeTaskJson
} from "./common.mjs";

const quickAdoptionPlan = [
  {
    slug: "session-storage-source-map",
    topics: ["session", "storage", "source-map"]
  },
  {
    slug: "bundle-frame-module-federation",
    topics: ["bundle-loader", "frame", "module-federation"]
  },
  {
    slug: "microfrontend-protocol-worker",
    topics: ["microfrontend-runtime", "protocol", "worker"]
  },
  {
    slug: "anti-debug-dynamic-code-wasm",
    topics: ["anti-debug", "dynamic-code", "wasm"]
  },
  {
    slug: "graphql-grpc-compression",
    topics: ["graphql-rpc", "grpc-web", "compression-stream"]
  }
];

const focusedScenarioPlan = [
  {
    slug: "signature-instrumentation-session-storage",
    topics: ["signature", "instrumentation-hooking", "session", "storage"]
  },
  {
    slug: "fingerprint-challenge-session-protocol",
    topics: ["fingerprint", "challenge-orchestration", "session", "protocol"]
  },
  {
    slug: "anti-tamper-cross-context-frame-worker",
    topics: ["anti-tamper", "cross-context-coordination", "frame", "worker"]
  },
  {
    slug: "behavior-beacon-session-protocol",
    topics: ["behavior-telemetry", "beacon-reporting", "session", "protocol"]
  },
  {
    slug: "webauthn-webrtc-media-session",
    topics: ["webauthn-passkey", "webrtc-datachannel", "media-drm", "session"]
  }
];

const extendedScenarioPlan = [
  {
    slug: "env-subtlecrypto-userland-signature",
    topics: ["env", "subtlecrypto", "userland-crypto", "signature"]
  },
  {
    slug: "ast-jsvmp-anti-tamper-hooking",
    topics: ["ast-deobfuscation", "jsvmp", "anti-tamper", "instrumentation-hooking"]
  },
  {
    slug: "framework-streaming-behavior-protocol",
    topics: ["framework-runtime", "streaming-runtime", "behavior-telemetry", "protocol"]
  },
  {
    slug: "binary-fingerprint-challenge-protocol",
    topics: ["binary-codec", "fingerprint", "challenge-orchestration", "protocol"]
  },
  {
    slug: "env-framework-session-storage",
    topics: ["env", "framework-runtime", "session", "storage"]
  }
];

const planRegistry = new Map([
  ["quick-adoption", quickAdoptionPlan],
  ["focused-scenarios", focusedScenarioPlan],
  ["extended-scenarios", extendedScenarioPlan]
]);

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
  "signatureAnalysis.inputBoundaryStatus": "mapped",
  "signatureAnalysis.canonicalizationStatus": "mapped",
  "signatureAnalysis.determinismMode": "deterministic",
  "signatureAnalysis.requestAcceptanceStatus": "passed",
  "signatureAnalysis.randomnessSource": "timestamp-nonce",
  "signatureAnalysis.clockSource": "date-now",
  "signatureAnalysis.stateDependencyStatus": "stateful",
  "protocol.transport": "websocket",
  "protocol.schemaStatus": "mapped",
  "protocol.streamModelStatus": "framed",
  "grpcWeb.frameStatus": "captured",
  "graphqlRpc.operationStatus": "captured",
  "compressionStream.pipelineStatus": "mapped",
  "moduleFederation.remoteEntryStatus": "mapped",
  "microfrontendRuntime.loaderStatus": "mapped",
  "workers.mappingStatus": "mapped",
  "wasmAnalysis.loaderStatus": "mapped",
  "wasmAnalysis.hookStatus": "captured",
  "antiDebug.triggerStage": "preload",
  "antiDebug.injectionStrategy": "runtime-hook"
};

function usage() {
  console.log(
    [
      "usage: node tools/task/seed-task-locals.mjs [--dry-run] [--skip-close] [--skip-existing] [--plan=quick-adoption] [--prefix=seed] [--tag=quick]",
      "",
      "defaults:",
      "- plan: quick-adoption (5 task-locals, 15 topics)",
      "- alt plan: focused-scenarios (5 task-locals, focus on higher-complexity组合场景)",
      "- alt plan: extended-scenarios (5 task-locals, 扩展更多专题组合)",
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
  const skipExisting = args.includes("--skip-existing");
  const planArg = args.find((arg) => arg.startsWith("--plan="));
  const prefixArg = args.find((arg) => arg.startsWith("--prefix="));
  const tagArg = args.find((arg) => arg.startsWith("--tag="));
  const plan = (planArg ? planArg.split("=").slice(1).join("=") : "quick-adoption")
    .trim()
    .toLowerCase();
  const prefix = (prefixArg ? prefixArg.split("=").slice(1).join("=") : "seed")
    .trim()
    .toLowerCase();
  const tag = (tagArg ? tagArg.split("=").slice(1).join("=") : "quick")
    .trim()
    .toLowerCase();

  return {
    dryRun,
    skipClose,
    skipExisting,
    plan: plan || "quick-adoption",
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
      WEB_REVERSE_SKILL_ROOT: skillRoot,
      WEB_REVERSE_WORKSPACE_ROOT: workspaceRoot
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
  const generatedAt = new Date().toISOString();

  task.targetContext.targetActionDescription = `seed task-local batch for ${topics.join(", ")}`;
  task.targetContext.objective = `quick closeout sample for ${topics.join(", ")}`;
  task.targetContext.targetKeywords = Array.from(
    new Set([...(task.targetContext.targetKeywords || []), ...topics, "seed", "quick-adoption"])
  );
  task.targetContext.targetFunctionNames = Array.from(
    new Set([...(task.targetContext.targetFunctionNames || []), "seedProbe", "seedReplay"])
  );
  task.targetContext.targetUrlPatterns = Array.from(
    new Set([...(task.targetContext.targetUrlPatterns || []), `https://seed.local/${topics[0] || "task"}`])
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

  if (topics.includes("jsvmp")) {
    task.vm ||= {};
    task.vm.present = true;
    task.vm.opcodeCoverage ||= "0%";
    task.vm.triageResult = "blackbox";
    task.vm.blackboxApi = "seedVmEntry";
    task.vm.triageReason = "seeded blackbox vm route";
    task.vm.triageNotes = Array.from(new Set([...(task.vm.triageNotes || []), "seeded blackbox vm route"]));
    task.routeState.vmTriage = {
      triageResult: "blackbox",
      blackboxApi: "seedVmEntry",
      rationale: "seeded blackbox vm route",
      notes: ["seeded blackbox vm route"],
      updatedAt: generatedAt
    };
  }

  applyFormalValidationSeeds(task, taskDir, topicSpecs, marker);
  writeTaskJson(taskDir, task);
}

function buildSpecs(prefix, tag, topicRegistry, planName) {
  const stamp = nowStamp();
  const topicMap = new Map(topicRegistry.map((topic) => [topic.key, topic]));
  const plan = planRegistry.get(planName);
  if (!plan) {
    throw new Error(`unknown seed plan: ${planName}`);
  }
  const specs = [];

  for (let i = 0; i < plan.length; i += 1) {
    const item = plan[i];
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
  const specs = buildSpecs(options.prefix, options.tag, topicRegistry, options.plan);
  const results = [];

  console.log(`[seed] workspace=${workspaceRoot}`);
  console.log(`[seed] plan=${options.plan}`);
  console.log(`[seed] tasks=${specs.length}, dryRun=${options.dryRun}, skipClose=${options.skipClose}, skipExisting=${options.skipExisting}`);

  for (const spec of specs) {
    const taskDir = resolveTaskDir(spec.taskId);
    if (options.skipExisting && fs.existsSync(path.join(taskDir, "task.json"))) {
      console.log(`[seed] skip existing ${spec.taskId}`);
      continue;
    }
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
    console.log("[seed] next: npm run check:fast");
  }
}

try {
  main();
} catch (error) {
  console.error(`[seed] FAILED: ${error.message}`);
  process.exit(1);
}
