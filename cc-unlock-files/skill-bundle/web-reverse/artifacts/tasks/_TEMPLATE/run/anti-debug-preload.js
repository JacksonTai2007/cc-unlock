"use strict";

function installPreloadAntiDebug(root = window) {
  const originalDateNow = Date.now;
  Date.now = () => originalDateNow();

  const originalPerfNow = performance.now.bind(performance);
  performance.now = () => originalPerfNow();

  ["setInterval", "setTimeout"].forEach((name) => {
    const original = root[name];
    root[name] = function (cb, delay, ...rest) {
      const source = typeof cb === "function" ? cb.toString() : String(cb);
      if (/debugger|devtools/i.test(source)) {
        console.log("[anti-debug:preload] blocked", name, source.slice(0, 120));
        return 0;
      }
      return original.call(this, cb, delay, ...rest);
    };
  });

  Object.defineProperty(root, "outerWidth", {
    configurable: true,
    get: () => root.innerWidth
  });
  Object.defineProperty(root, "outerHeight", {
    configurable: true,
    get: () => root.innerHeight
  });

  const OriginalFunction = root.Function;
  root.Function = new Proxy(OriginalFunction, {
    construct(target, args) {
      const body = args[args.length - 1] || "";
      if (typeof body === "string" && /debugger/.test(body)) {
        args[args.length - 1] = body.replace(/\bdebugger\b/g, "0");
      }
      return Reflect.construct(target, args);
    }
  });

  return {
    strategy: "preload",
    patterns: ["timer", "timing", "size", "dynamic-code"]
  };
}

module.exports = { installPreloadAntiDebug };

