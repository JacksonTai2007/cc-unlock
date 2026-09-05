import path from "node:path";
import {
  clone,
  readJsonFile,
  skillRoot
} from "./common.mjs";

export const defaultTaskInputSchemaPath = path.join(
  skillRoot,
  "references",
  "schemas",
  "win-reverse-task-input.schema.json"
);

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeTextArray(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => cleanText(item))
        .filter(Boolean)
    )
  );
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function joinJsonPath(basePath, key) {
  if (typeof key === "number") {
    return `${basePath}[${key}]`;
  }
  return basePath === "$" ? `$.${key}` : `${basePath}.${key}`;
}

function matchesType(value, type) {
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return Number.isInteger(value);
    case "null":
      return value === null;
    default:
      return true;
  }
}

function validateNode(value, schema, at = "$") {
  if (!schema || typeof schema !== "object") {
    return [];
  }

  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const branchResults = schema.anyOf.map((branch) => validateNode(value, branch, at));
    if (branchResults.some((errors) => errors.length === 0)) {
      return [];
    }
    return [`${at} does not match any supported input shape`];
  }

  const errors = [];
  const expectedTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];

  if (expectedTypes.length > 0 && !expectedTypes.some((type) => matchesType(value, type))) {
    errors.push(`${at} must be ${expectedTypes.join(" or ")}`);
    return errors;
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0 && !schema.enum.includes(value)) {
    errors.push(`${at} must be one of: ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}`);
  }

  if (typeof value === "string" && Number.isFinite(schema.minLength) && value.trim().length < schema.minLength) {
    errors.push(`${at} must have length >= ${schema.minLength}`);
  }

  if (Array.isArray(value)) {
    if (Number.isFinite(schema.minItems) && value.length < schema.minItems) {
      errors.push(`${at} must contain at least ${schema.minItems} item(s)`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateNode(item, schema.items, joinJsonPath(at, index)));
      });
    }
  }

  if (isPlainObject(value)) {
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${joinJsonPath(at, key)} is required`);
      }
    }

    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        errors.push(...validateNode(value[key], childSchema, joinJsonPath(at, key)));
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${joinJsonPath(at, key)} is not allowed`);
        }
      }
    }
  }

  return errors;
}

export function readTaskInputSchema(schemaPath = defaultTaskInputSchemaPath) {
  return readJsonFile(schemaPath);
}

export function normalizeTaskInputShape(taskInput = {}) {
  const input = isPlainObject(taskInput) ? clone(taskInput) : {};

  const target = typeof input.target === "string"
    ? { value: input.target }
    : isPlainObject(input.target)
      ? clone(input.target)
      : { value: "" };
  target.value = cleanText(target.value);
  if ("binaryPath" in target) {
    target.binaryPath = cleanText(target.binaryPath);
  }
  if ("samplePaths" in target) {
    target.samplePaths = normalizeTextArray(target.samplePaths);
  }

  const requirements = Array.isArray(input.requirements)
    ? {
        deliverables: normalizeTextArray(input.requirements),
        localReproductionRequested: false,
        protocolReplayExampleRequired: false,
        apiCallExampleRequired: false
      }
    : isPlainObject(input.requirements)
      ? {
          ...clone(input.requirements),
          deliverables: normalizeTextArray(input.requirements.deliverables),
          localReproductionRequested: input.requirements.localReproductionRequested === true,
          protocolReplayExampleRequired: input.requirements.protocolReplayExampleRequired === true,
          apiCallExampleRequired: input.requirements.apiCallExampleRequired === true
        }
      : {
          deliverables: [],
          localReproductionRequested: false,
          protocolReplayExampleRequired: false,
          apiCallExampleRequired: false
        };

  const boundaries = Array.isArray(input.boundaries)
    ? {
        inScope: normalizeTextArray(input.boundaries),
        outOfScope: []
      }
    : isPlainObject(input.boundaries)
      ? {
          ...clone(input.boundaries),
          inScope: normalizeTextArray(input.boundaries.inScope),
          outOfScope: normalizeTextArray(input.boundaries.outOfScope)
        }
      : {
          inScope: [],
          outOfScope: []
        };

  const runtime = isPlainObject(input.runtime)
    ? {
        ...clone(input.runtime),
        architecture: cleanText(input.runtime.architecture),
        wow64: cleanText(input.runtime.wow64),
        managed: input.runtime.managed === true,
        kernelMode: input.runtime.kernelMode === true
      }
    : {};

  const access = isPlainObject(input.access)
    ? {
        ...clone(input.access),
        adminRequired: input.access.adminRequired === true,
        interactiveUnlockRequired: input.access.interactiveUnlockRequired === true,
        driverSigningBypassRequired: input.access.driverSigningBypassRequired === true
      }
    : {};

  return {
    ...input,
    target,
    objective: cleanText(input.objective),
    requirements,
    boundaries,
    runtime,
    access,
    samplePaths: normalizeTextArray(input.samplePaths),
    focusSignals: normalizeTextArray(input.focusSignals)
  };
}

export function validateTaskInput(taskInput, options = {}) {
  const schema = readTaskInputSchema(options.schemaPath);
  const normalized = normalizeTaskInputShape(taskInput);
  const errors = validateNode(taskInput, schema);

  if (
    normalized.requirements.protocolReplayExampleRequired === true &&
    normalized.requirements.localReproductionRequested !== true
  ) {
    errors.push(
      "$.requirements.protocolReplayExampleRequired requires $.requirements.localReproductionRequested=true"
    );
  }

  if (
    normalized.requirements.apiCallExampleRequired === true &&
    normalized.requirements.localReproductionRequested !== true
  ) {
    errors.push(
      "$.requirements.apiCallExampleRequired requires $.requirements.localReproductionRequested=true"
    );
  }

  if (
    normalized.boundaries &&
    normalized.boundaries.inScope.length === 0 &&
    normalized.boundaries.outOfScope.length === 0
  ) {
    errors.push("$.boundaries must declare at least one inScope or outOfScope item");
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized
  };
}
