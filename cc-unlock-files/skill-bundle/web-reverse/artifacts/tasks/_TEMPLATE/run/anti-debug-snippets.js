"use strict";

function installAntiDebugBypass(root = window) {
  const originalDateNow = Date.now;
  Date.now = () => originalDateNow();

  const originalPerfNow = performance.now.bind(performance);
  performance.now = () => originalPerfNow();

  ["setInterval", "setTimeout"].forEach((name) => {
    const original = root[name];
    root[name] = function (cb, delay, ...rest) {
      const source = typeof cb === "function" ? cb.toString() : String(cb);
      if (/debugger|devtools/i.test(source)) {
        console.log("[anti-debug] blocked", name, source.slice(0, 120));
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

  const originalToString = Function.prototype.toString;
  Function.prototype.toString = function () {
    if (this.__isHook__) {
      return `function ${this.__originalName__ || this.name}() { [native code] }`;
    }
    return originalToString.call(this);
  };
}

module.exports = { installAntiDebugBypass };

