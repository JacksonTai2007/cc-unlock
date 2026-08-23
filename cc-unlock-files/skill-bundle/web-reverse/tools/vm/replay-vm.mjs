import fs from "node:fs";
import path from "node:path";
import nodeVm from "node:vm";

function parseArgs(argv) {
  const args = {
    entry: "",
    context: "",
    fixture: "",
    preloads: []
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--entry") args.entry = argv[++i] || "";
    else if (token === "--context") args.context = argv[++i] || "";
    else if (token === "--fixture") args.fixture = argv[++i] || "";
    else if (token === "--preload") args.preloads.push(argv[++i] || "");
  }

  return args;
}

function readJsonMaybe(filePath) {
  if (!filePath) return {};
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function runScript(filename, context) {
  const code = fs.readFileSync(filename, "utf8");
  const script = new nodeVm.Script(code, { filename });
  return script.runInContext(context);
}

function createProcessShim(contextData = {}) {
  const shimEnv = contextData.process?.env && typeof contextData.process.env === "object"
    ? { ...contextData.process.env }
    : {};

  const shimArgv = Array.isArray(contextData.process?.argv)
    ? contextData.process.argv.slice()
    : [];

  return Object.freeze({
    env: shimEnv,
    argv: shimArgv,
    platform: String(contextData.process?.platform || "browser-like"),
    versions: Object.freeze({}),
    cwd() {
      return "/";
    },
    exit(code = 0) {
      throw new Error(`process.exit(${code}) is disabled in replay-vm sandbox`);
    },
    nextTick(callback, ...args) {
      if (typeof callback === "function") {
        queueMicrotask(() => callback(...args));
      }
    }
  });
}

const args = parseArgs(process.argv);
if (!args.entry) {
  console.error("usage: node tools/vm/replay-vm.mjs --entry <file.js> [--preload <file.js> ...] [--context <profile.json>] [--fixture <fixtures.json>]");
  process.exit(1);
}

const contextData = readJsonMaybe(args.context);
const fixtureData = readJsonMaybe(args.fixture);

const moduleRef = { exports: {} };
const processShim = createProcessShim(contextData);

const sandbox = {
  console,
  Buffer,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  structuredClone,
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  module: moduleRef,
  exports: moduleRef.exports,
  process: processShim,
  globalThis: null,
  __vmProfile: contextData,
  __fixtures: fixtureData
};

Object.assign(sandbox, contextData.globals || {});
sandbox.globalThis = sandbox;

const context = nodeVm.createContext(sandbox);

for (const preload of args.preloads) {
  runScript(path.resolve(preload), context);
}

runScript(path.resolve(args.entry), context);

const exported = moduleRef.exports;
const exportKeys = exported && typeof exported === "object" ? Object.keys(exported) : [];
console.log(JSON.stringify({
  entry: path.resolve(args.entry),
  preloads: args.preloads.map((item) => path.resolve(item)),
  hasExports: exportKeys.length > 0,
  exportKeys
}, null, 2));
