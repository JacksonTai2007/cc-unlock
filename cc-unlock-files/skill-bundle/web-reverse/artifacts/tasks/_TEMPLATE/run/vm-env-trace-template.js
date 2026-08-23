"use strict";

function ensureLogSink(logger) {
  return typeof logger === "function" ? logger : console.log;
}

function defaultSerializer(value) {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 8);
  }
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).slice(0, 8)) {
      const item = value[key];
      out[key] =
        item == null || typeof item === "string" || typeof item === "number" || typeof item === "boolean"
          ? item
          : typeof item;
    }
    return out;
  }
  return typeof value;
}

function tracePropertyReads(target, propertySpecs, options = {}) {
  const logger = ensureLogSink(options.logger);
  const serializer = options.serializer || defaultSerializer;
  const label = options.label || "vm-env-read";
  const restores = [];

  for (const spec of propertySpecs || []) {
    const {
      object,
      property,
      alias
    } = spec || {};

    if (!object || !property) continue;

    const original = Object.getOwnPropertyDescriptor(object, property);
    if (!original) continue;
    if (!original.configurable) continue;

    const getter = original.get || (() => original.value);
    const setter = original.set;

    Object.defineProperty(object, property, {
      configurable: true,
      enumerable: original.enumerable !== false,
      get() {
        const value = getter.call(this);
        logger(`[${label}]`, JSON.stringify({
          type: "get",
          property: alias || property,
          value: serializer(value)
        }));
        return value;
      },
      set(value) {
        logger(`[${label}]`, JSON.stringify({
          type: "set",
          property: alias || property,
          value: serializer(value)
        }));
        if (setter) {
          return setter.call(this, value);
        }
        return value;
      }
    });

    restores.push(() => {
      Object.defineProperty(object, property, original);
    });
  }

  return function restore() {
    for (const restore of restores.reverse()) {
      restore();
    }
  };
}

function traceFunctionCalls(target, methods, options = {}) {
  const logger = ensureLogSink(options.logger);
  const serializer = options.serializer || defaultSerializer;
  const label = options.label || "vm-env-call";

  for (const methodName of methods || []) {
    const original = target?.[methodName];
    if (typeof original !== "function") continue;

    target[methodName] = function (...args) {
      logger(`[${label}]`, JSON.stringify({
        type: "call",
        method: methodName,
        argc: args.length,
        args: args.map((item) => serializer(item))
      }));
      const rv = original.apply(this, args);
      logger(`[${label}]`, JSON.stringify({
        type: "return",
        method: methodName,
        result: serializer(rv)
      }));
      return rv;
    };
  }

  return target;
}

module.exports = {
  tracePropertyReads,
  traceFunctionCalls
};
