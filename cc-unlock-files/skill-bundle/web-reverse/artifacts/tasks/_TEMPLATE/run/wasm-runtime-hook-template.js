const wasmState = {
  modules: [],
  instances: []
};

function summarizeImports(importObject) {
  if (!importObject || typeof importObject !== "object") {
    return {};
  }
  const summary = {};
  for (const [moduleName, fields] of Object.entries(importObject)) {
    summary[moduleName] = Object.keys(fields || {});
  }
  return summary;
}

function summarizeExports(instance) {
  if (!instance?.exports) {
    return [];
  }
  return Object.keys(instance.exports).map((name) => {
    const value = instance.exports[name];
    if (typeof value === "function") return { name, kind: "function" };
    if (value instanceof WebAssembly.Memory) return { name, kind: "memory" };
    if (value instanceof WebAssembly.Table) return { name, kind: "table" };
    if (value instanceof WebAssembly.Global) return { name, kind: "global" };
    return { name, kind: typeof value };
  });
}

function rememberInstance(result, importObject, sourceKind) {
  const instance = result?.instance ?? result;
  wasmState.instances.push({
    ts: Date.now(),
    sourceKind,
    imports: summarizeImports(importObject),
    exports: summarizeExports(instance)
  });
  console.log("[wasm-runtime] exports:", JSON.stringify(summarizeExports(instance)));
  return result;
}

const originalInstantiate = WebAssembly.instantiate;
WebAssembly.instantiate = async function patchedInstantiate(bufferOrModule, importObject) {
  wasmState.modules.push({
    ts: Date.now(),
    api: "instantiate",
    bufferLength: bufferOrModule?.byteLength ?? null,
    sourceKind: bufferOrModule instanceof WebAssembly.Module ? "module" : "buffer"
  });
  const result = await originalInstantiate.call(this, bufferOrModule, importObject);
  return rememberInstance(result, importObject, "instantiate");
};

const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
WebAssembly.instantiateStreaming = async function patchedInstantiateStreaming(responsePromise, importObject) {
  const response = await responsePromise;
  const clone = response.clone();
  const bytes = await clone.arrayBuffer();
  wasmState.modules.push({
    ts: Date.now(),
    api: "instantiateStreaming",
    bufferLength: bytes.byteLength,
    sourceKind: "streaming-response"
  });
  const rebuilt = new Response(bytes, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText
  });
  const result = await originalInstantiateStreaming.call(this, Promise.resolve(rebuilt), importObject);
  return rememberInstance(result, importObject, "instantiateStreaming");
};

globalThis.__wasmRuntimeState = wasmState;
