import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = { config: "", out: "", label: "vm-runtime" };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--config") args.config = argv[++i] || "";
    else if (token === "--out") args.out = argv[++i] || "";
    else if (token === "--label") args.label = argv[++i] || "";
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function toPathSpecList(config) {
  const propertyReads = Array.isArray(config.propertyReads) ? config.propertyReads : [];
  const methodCalls = Array.isArray(config.methodCalls) ? config.methodCalls : [];
  return {
    propertyReads: propertyReads.map((item) => typeof item === "string" ? { path: item } : item),
    methodCalls: methodCalls.map((item) => typeof item === "string" ? { path: item } : item)
  };
}

function renderHook({ label, propertyReads, methodCalls }) {
  return `(() => {
  const LABEL = ${JSON.stringify(label)};
  const log = (payload) => console.log(\`[\${LABEL}]\`, JSON.stringify(payload));
  const splitPath = (input) => String(input || "").split(".").filter(Boolean);
  const resolveTarget = (pathText) => {
    const parts = splitPath(pathText);
    let owner = globalThis;
    for (let i = 0; i < parts.length - 1; i += 1) {
      owner = owner?.[parts[i]];
      if (!owner) return null;
    }
    return {
      owner,
      key: parts[parts.length - 1]
    };
  };
  const findDescriptor = (owner, key) => {
    let cursor = owner;
    while (cursor) {
      const descriptor = Object.getOwnPropertyDescriptor(cursor, key);
      if (descriptor) {
        return {
          holder: cursor,
          descriptor
        };
      }
      cursor = Object.getPrototypeOf(cursor);
    }
    return null;
  };
  const serialize = (value) => {
    if (value == null) return value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.slice(0, 8);
    if (typeof value === "object") return Object.keys(value).slice(0, 8);
    return typeof value;
  };

  for (const spec of ${JSON.stringify(propertyReads)}) {
    const resolved = resolveTarget(spec.path);
    if (!resolved) {
      log({ type: "skip", kind: "property", path: spec.path, reason: "target-not-found" });
      continue;
    }
    const found = findDescriptor(resolved.owner, resolved.key);
    if (!found) {
      log({ type: "skip", kind: "property", path: spec.path, reason: "descriptor-not-found" });
      continue;
    }
    const { holder, descriptor } = found;
    if (holder === resolved.owner && !descriptor.configurable) {
      log({ type: "skip", kind: "property", path: spec.path, reason: "descriptor-not-configurable" });
      continue;
    }
    const getter = descriptor.get || (() => descriptor.value);
    const setter = descriptor.set;
    Object.defineProperty(resolved.owner, resolved.key, {
      configurable: true,
      enumerable: descriptor.enumerable !== false,
      get() {
        const value = getter.call(this);
        log({ type: "get", path: spec.path, alias: spec.alias || "", value: serialize(value) });
        return value;
      },
      set(value) {
        log({ type: "set", path: spec.path, alias: spec.alias || "", value: serialize(value) });
        if (setter) return setter.call(this, value);
        return value;
      }
    });
  }

  for (const spec of ${JSON.stringify(methodCalls)}) {
    const resolved = resolveTarget(spec.path);
    if (!resolved) {
      log({ type: "skip", kind: "method", path: spec.path, reason: "target-not-found" });
      continue;
    }
    const found = findDescriptor(resolved.owner, resolved.key);
    if (!found) {
      log({ type: "skip", kind: "method", path: spec.path, reason: "descriptor-not-found" });
      continue;
    }
    const original = resolved.owner?.[resolved.key];
    if (typeof original !== "function") continue;
    resolved.owner[resolved.key] = function (...args) {
      log({ type: "call", path: spec.path, alias: spec.alias || "", argc: args.length, args: args.map(serialize) });
      const rv = original.apply(this, args);
      log({ type: "return", path: spec.path, alias: spec.alias || "", result: serialize(rv) });
      return rv;
    };
  }
})();`;
}

const args = parseArgs(process.argv);
if (!args.config) {
  console.error("usage: node tools/vm/trace-runtime.mjs --config <profile.json> [--out <hook.js>] [--label <name>]");
  process.exit(1);
}

const configPath = path.resolve(args.config);
const config = readJson(configPath);
const specs = toPathSpecList(config);
const rendered = renderHook({
  label: args.label || config.label || "vm-runtime",
  ...specs
});

if (args.out) {
  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, rendered);
  console.log(`generated: ${outPath}`);
} else {
  process.stdout.write(rendered);
}
