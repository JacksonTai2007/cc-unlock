"use strict";

const CONFIG = {
  targetClassSubstrings: [
    // "com.target."
  ],
  targetDexSubstrings: [
    // "payload"
  ],
  traceLoadClass: false,
  printStackOnLoaderCreation: false
};

function log(message) {
  console.log("[class-loader-trace] " + message);
}

function safeToString(value) {
  if (value === null || value === undefined) {
    return String(value);
  }

  try {
    return value.toString();
  } catch (error) {
    return "<toString failed: " + error + ">";
  }
}

function stackTrace() {
  const Log = Java.use("android.util.Log");
  const Throwable = Java.use("java.lang.Throwable");
  return Log.getStackTraceString(Throwable.$new());
}

function matchAny(value, needles) {
  if (!needles || needles.length === 0) {
    return true;
  }

  return needles.some(function (item) {
    return String(value || "").indexOf(item) !== -1;
  });
}

function dumpLoaderChain(loader) {
  const parts = [];
  let current = loader;
  let depth = 0;

  while (current && depth < 8) {
    parts.push(safeToString(current));
    try {
      current = current.getParent();
    } catch (error) {
      parts.push("<parent-error:" + error + ">");
      break;
    }
    depth += 1;
  }

  return parts.join(" -> ");
}

function logLoaderCreation(label, details, loader) {
  if (!matchAny(details, CONFIG.targetDexSubstrings)) {
    return;
  }

  log(label + " " + details);
  if (loader) {
    log("  chain " + dumpLoaderChain(loader));
  }
  if (CONFIG.printStackOnLoaderCreation) {
    log("  stack:\n" + stackTrace());
  }
}

Java.perform(function () {
  const DexClassLoader = Java.use("dalvik.system.DexClassLoader");
  const PathClassLoader = Java.use("dalvik.system.PathClassLoader");
  const ClassLoader = Java.use("java.lang.ClassLoader");
  const Application = Java.use("android.app.Application");

  DexClassLoader.$init.overloads.forEach(function (overload) {
    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      const result = overload.apply(this, args);
      const detail = "dexPath=" + safeToString(args[0]) +
        " optDir=" + safeToString(args[1]) +
        " libSearchPath=" + safeToString(args[2]);
      logLoaderCreation("DexClassLoader", detail, this);
      return result;
    };
  });

  PathClassLoader.$init.overloads.forEach(function (overload) {
    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      const result = overload.apply(this, args);
      const detail = "path=" + safeToString(args[0]);
      logLoaderCreation("PathClassLoader", detail, this);
      return result;
    };
  });

  try {
    const InMemoryDexClassLoader = Java.use("dalvik.system.InMemoryDexClassLoader");
    InMemoryDexClassLoader.$init.overloads.forEach(function (overload) {
      overload.implementation = function () {
        const args = Array.prototype.slice.call(arguments);
        const result = overload.apply(this, args);
        let detail = "buffers=" + args.length;
        try {
          if (args[0] && args[0].remaining) {
            detail += " firstRemaining=" + args[0].remaining();
          }
        } catch (error) {
          detail += " remaining=<error:" + error + ">";
        }
        logLoaderCreation("InMemoryDexClassLoader", detail, this);
        return result;
      };
    });
  } catch (error) {
    log("InMemoryDexClassLoader unavailable: " + error);
  }

  Application.attach.overload("android.content.Context").implementation = function (context) {
    const result = Application.attach.overload("android.content.Context").call(this, context);
    log("Application.attach package=" + context.getPackageName());
    log("  appLoader " + dumpLoaderChain(context.getClassLoader()));
    return result;
  };

  if (CONFIG.traceLoadClass) {
    ClassLoader.loadClass.overloads.forEach(function (overload) {
      overload.implementation = function () {
        const args = Array.prototype.slice.call(arguments);
        const name = String(args[0]);
        const result = overload.apply(this, args);
        if (matchAny(name, CONFIG.targetClassSubstrings)) {
          log("loadClass " + name + " via " + safeToString(this));
        }
        return result;
      };
    });
  }
});
