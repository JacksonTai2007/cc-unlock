"use strict";

function installRuntimeAntiDebug(root = window) {
  const originalToString = Function.prototype.toString;
  Function.prototype.toString = function () {
    if (this.__isHook__) {
      return `function ${this.__originalName__ || this.name}() { [native code] }`;
    }
    return originalToString.call(this);
  };

  const originalConsoleLog = console.log;
  Object.defineProperty(console, "log", {
    value: originalConsoleLog,
    writable: false,
    configurable: false
  });

  function hookBridge(obj, name) {
    const original = obj?.[name];
    if (typeof original !== "function") return false;
    obj[name] = function (...args) {
      console.log("[anti-debug:runtime:in]", name, args);
      const rv = original.apply(this, args);
      console.log("[anti-debug:runtime:out]", name, rv);
      return rv;
    };
    obj[name].__isHook__ = true;
    obj[name].__originalName__ = name;
    return true;
  }

  return {
    strategy: "runtime",
    patterns: ["integrity", "console"],
    hookBridge
  };
}

module.exports = { installRuntimeAntiDebug };

