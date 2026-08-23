const state = {
  hits: []
};

function summarizeSource(source) {
  const text = String(source ?? "");
  return {
    length: text.length,
    preview: text.slice(0, 120),
    trailer: text.slice(-120)
  };
}

function pushHit(kind, payload) {
  const summary = summarizeSource(payload);
  state.hits.push({
    ts: Date.now(),
    kind,
    ...summary
  });
  console.log(`[dynamic-code] ${kind} len=${summary.length}`);
}

const originalEval = globalThis.eval;
globalThis.eval = function patchedEval(source) {
  pushHit("eval", source);
  return originalEval.apply(this, arguments);
};

const OriginalFunction = globalThis.Function;
globalThis.Function = function PatchedFunction(...args) {
  pushHit("Function", args[args.length - 1] ?? "");
  return OriginalFunction.apply(this, args);
};
globalThis.Function.prototype = OriginalFunction.prototype;

const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = function patchedSetTimeout(handler, timeout, ...rest) {
  if (typeof handler === "string") {
    pushHit("setTimeout-string", handler);
  }
  return originalSetTimeout.call(this, handler, timeout, ...rest);
};

const originalSetInterval = globalThis.setInterval;
globalThis.setInterval = function patchedSetInterval(handler, timeout, ...rest) {
  if (typeof handler === "string") {
    pushHit("setInterval-string", handler);
  }
  return originalSetInterval.call(this, handler, timeout, ...rest);
};

globalThis.__dynamicCodeCapture = state;
