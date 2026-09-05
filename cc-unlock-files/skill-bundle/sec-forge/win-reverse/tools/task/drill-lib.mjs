import fs from "node:fs";
import path from "node:path";
import {
  getTopicBySpecifier,
  mergeDeep,
  nowIso,
  skillRoot
} from "./common.mjs";
import {
  normalizeTaskInputShape,
  validateTaskInput
} from "./task-input-schema.mjs";

export const drillsRoot = path.join(skillRoot, "drills");

function cleanText(value) {
  return String(value || "").trim();
}

function uniq(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean)
    )
  );
}

export function listDrillManifestPaths() {
  if (!fs.existsSync(drillsRoot)) {
    return [];
  }

  return fs
    .readdirSync(drillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(drillsRoot, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export function readDrillManifest(filePath) {
  const drill = JSON.parse(fs.readFileSync(filePath, "utf8"));
  drill.id ||= path.basename(filePath, path.extname(filePath));
  drill.__filePath = filePath;
  return drill;
}

export function listDrills() {
  return listDrillManifestPaths().map((filePath) => readDrillManifest(filePath));
}

export function getDrillById(drillId) {
  const normalized = cleanText(drillId).toLowerCase();
  return listDrills().find((drill) => cleanText(drill.id).toLowerCase() === normalized) || null;
}

export function buildTaskInputFromDrill(drill) {
  return normalizeTaskInputShape(
    mergeDeep(
      {
        target: {
          value: ""
        },
        objective: "",
        requirements: {
          deliverables: [],
          localReproductionRequested: false,
          protocolReplayExampleRequired: false
        },
        boundaries: {
          inScope: []
        }
      },
      drill?.taskInput || {}
    )
  );
}

export function buildTaskStartArgs(drill, taskId, options = {}) {
  const args = [taskId];
  if (options.forceNewTask) {
    args.push("--force-new-task");
  }
  if (Array.isArray(drill?.topics) && drill.topics.length > 0) {
    args.push(`--topics=${uniq(drill.topics).join(",")}`);
  }
  if (cleanText(drill?.taskInit?.protectionTier)) {
    args.push(`--protection-tier=${cleanText(drill.taskInit.protectionTier)}`);
  }
  if (drill?.taskInit?.localReproductionRequested === true) {
    args.push("--local-repro");
  }
  if (drill?.taskInit?.protocolReplayExampleRequired === true) {
    args.push("--protocol-replay");
  }
  return args;
}

export function validateDrillManifest(drill) {
  const errors = [];
  const id = cleanText(drill?.id);
  const title = cleanText(drill?.title);
  const summary = cleanText(drill?.summary);
  const topics = uniq(drill?.topics || []);
  const taskInput = buildTaskInputFromDrill(drill);
  const successCriteria = Array.isArray(drill?.taskPatch?.successCriteria)
    ? drill.taskPatch.successCriteria.map((item) => cleanText(item)).filter(Boolean)
    : [];
  const caseFiles = Array.isArray(drill?.taskPatch?.taskDrill?.caseFiles)
    ? drill.taskPatch.taskDrill.caseFiles.map((item) => cleanText(item)).filter(Boolean)
    : [];

  if (!id) {
    errors.push("missing id");
  } else if (!/^[a-z0-9-]+$/.test(id)) {
    errors.push(`invalid id '${id}'`);
  }
  if (!title) {
    errors.push("missing title");
  }
  if (!summary) {
    errors.push("missing summary");
  }
  if (topics.length < 2) {
    errors.push("topics must contain at least 2 topic keys");
  }
  for (const topicKey of topics) {
    if (!getTopicBySpecifier(topicKey)) {
      errors.push(`unknown topic '${topicKey}'`);
    }
  }
  const taskInputValidation = validateTaskInput(taskInput);
  errors.push(...taskInputValidation.errors.map((error) => `taskInput ${error}`));
  if (successCriteria.length === 0) {
    errors.push("taskPatch.successCriteria must contain at least 1 item");
  }
  for (const caseFile of caseFiles) {
    const resolved = path.join(skillRoot, ...caseFile.split("/"));
    if (!fs.existsSync(resolved)) {
      errors.push(`missing case file '${caseFile}'`);
    }
  }
  return errors;
}

export function decorateTaskWithDrill(task, drill) {
  const taskInput = buildTaskInputFromDrill(drill);
  const patch = mergeDeep({}, drill?.taskPatch || {});
  const nextTask = mergeDeep(task, patch);
  nextTask.taskDrill ||= {};
  nextTask.taskDrill.scenarioId = cleanText(drill?.id);
  nextTask.taskDrill.title = cleanText(drill?.title);
  nextTask.taskDrill.summary = cleanText(drill?.summary);
  nextTask.taskDrill.difficulty = cleanText(drill?.difficulty) || "unspecified";
  nextTask.taskDrill.topics = uniq(drill?.topics || []);
  nextTask.taskDrill.boundaries = mergeDeep({}, taskInput?.boundaries || {});
  nextTask.taskDrill.seededAt = nowIso();
  nextTask.taskDrill.source = path.relative(skillRoot, drill?.__filePath || "").replaceAll("\\", "/");
  nextTask.boundaries ||= {};
  nextTask.boundaries.drill = mergeDeep({}, taskInput?.boundaries || {});
  nextTask.targetContext ||= {};
  if (
    !cleanText(nextTask.targetContext.targetActionDescription) ||
    nextTask.targetContext.targetActionDescription === "replace-with-real-trigger-action"
  ) {
    nextTask.targetContext.targetActionDescription =
      cleanText(taskInput?.objective) ||
      cleanText(drill?.title);
  }
  return nextTask;
}

export function formatDrillSummary(drill) {
  const topics = uniq(drill?.topics || []);
  return `${drill.id}: ${cleanText(drill.title)} [${topics.join(", ")}]`;
}
