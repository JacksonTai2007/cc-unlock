const globalObject = globalThis;
const storeKey = "__fingerprintInspectorLog";

function getContextLabel() {
  try {
    if (typeof WorkerGlobalScope !== "undefined" && globalObject instanceof WorkerGlobalScope) {
      return "worker";
    }
  } catch {}

  try {
    if (typeof window !== "undefined" && window !== window.top) {
      return "iframe";
    }
  } catch {}

  return "window";
}

function ensureStore() {
  if (!Array.isArray(globalObject[storeKey])) {
    globalObject[storeKey] = [];
  }
  return globalObject[storeKey];
}

function summarize(value) {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 8);
  }
  if (typeof value === "object") {
    const summary = {};
    for (const key of Object.keys(value).slice(0, 8)) {
      const item = value[key];
      if (typeof item !== "function") {
        summary[key] = item;
      }
    }
    return summary;
  }
  return String(value);
}

function record(kind, name, detail = {}) {
  ensureStore().push({
    at: new Date().toISOString(),
    context: getContextLabel(),
    kind,
    name,
    ...detail
  });
}

function wrapGetter(target, property, label) {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  if (!descriptor || typeof descriptor.get !== "function" || descriptor.configurable !== true) {
    record("skip", label, { reason: "getter-unavailable" });
    return;
  }

  Object.defineProperty(target, property, {
    ...descriptor,
    get() {
      const value = descriptor.get.call(this);
      record("getter", label, { value: summarize(value) });
      return value;
    }
  });
}

function wrapMethod(target, property, label, serializer = (args) => ({ args: summarize(args) })) {
  const original = target?.[property];
  if (typeof original !== "function") {
    record("skip", label, { reason: "method-unavailable" });
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  if (descriptor && descriptor.configurable !== true) {
    record("skip", label, { reason: "method-not-configurable" });
    return;
  }

  Object.defineProperty(target, property, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: function wrappedMethod(...args) {
      record("method", label, serializer(args));
      return Reflect.apply(original, this, args);
    }
  });
}

function wrapConstructor(target, property, label, serializer = (args) => ({ args: summarize(args) })) {
  const Original = target?.[property];
  if (typeof Original !== "function") {
    record("skip", label, { reason: "constructor-unavailable" });
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  if (descriptor && descriptor.configurable !== true) {
    record("skip", label, { reason: "constructor-not-configurable" });
    return;
  }

  function WrappedConstructor(...args) {
    record("constructor", label, serializer(args));
    return Reflect.construct(Original, args, new.target || WrappedConstructor);
  }

  WrappedConstructor.prototype = Original.prototype;
  Object.setPrototypeOf(WrappedConstructor, Original);

  Object.defineProperty(target, property, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: WrappedConstructor
  });
}

export function installFingerprintInspector() {
  const installedKey = "__fingerprintInspectorInstalled";
  if (globalObject[installedKey]) {
    return ensureStore();
  }
  globalObject[installedKey] = true;

  record("install", "fingerprint-inspector", {
    notes: "按最小侵入原则观察 navigator/canvas/webgl/audio/worker 读点"
  });

  if (typeof Navigator !== "undefined") {
    for (const property of [
      "webdriver",
      "userAgent",
      "platform",
      "language",
      "languages",
      "hardwareConcurrency",
      "deviceMemory",
      "maxTouchPoints"
    ]) {
      wrapGetter(Navigator.prototype, property, `navigator.${property}`);
    }
  }

  if (typeof Screen !== "undefined") {
    for (const property of ["width", "height", "availWidth", "availHeight", "colorDepth", "pixelDepth"]) {
      wrapGetter(Screen.prototype, property, `screen.${property}`);
    }
  }

  if (typeof navigator !== "undefined" && navigator.userAgentData) {
    wrapMethod(
      navigator.userAgentData,
      "getHighEntropyValues",
      "navigator.userAgentData.getHighEntropyValues",
      ([hints]) => ({ hints: summarize(hints) })
    );
  }

  if (typeof HTMLCanvasElement !== "undefined") {
    wrapMethod(HTMLCanvasElement.prototype, "toDataURL", "canvas.toDataURL");
    wrapMethod(HTMLCanvasElement.prototype, "toBlob", "canvas.toBlob");
    wrapMethod(
      HTMLCanvasElement.prototype,
      "getContext",
      "canvas.getContext",
      ([type]) => ({ contextType: type })
    );
  }

  if (typeof CanvasRenderingContext2D !== "undefined") {
    wrapMethod(CanvasRenderingContext2D.prototype, "getImageData", "canvas2d.getImageData");
    wrapMethod(CanvasRenderingContext2D.prototype, "measureText", "canvas2d.measureText", ([text]) => ({
      textSample: String(text).slice(0, 80)
    }));
  }

  for (const ctorName of ["WebGLRenderingContext", "WebGL2RenderingContext"]) {
    const ctor = globalObject[ctorName];
    if (!ctor?.prototype) {
      continue;
    }
    wrapMethod(ctor.prototype, "getParameter", `${ctorName}.getParameter`, ([param]) => ({ param }));
    wrapMethod(ctor.prototype, "getExtension", `${ctorName}.getExtension`, ([name]) => ({ name }));
  }

  for (const ctorName of ["OfflineAudioContext", "webkitOfflineAudioContext"]) {
    const ctor = globalObject[ctorName];
    if (!ctor?.prototype) {
      continue;
    }
    wrapMethod(ctor.prototype, "startRendering", `${ctorName}.startRendering`);
  }

  if (typeof Worker !== "undefined") {
    wrapConstructor(globalObject, "Worker", "global.Worker", ([url]) => ({ url: summarize(url) }));
  }

  return ensureStore();
}

export function dumpFingerprintInspectorLog() {
  return ensureStore().slice();
}
