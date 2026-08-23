"use strict";

const CONFIG = {
  targetClassSubstrings: [
    // "com.target."
  ],
  targetDexSubstrings: [
    // "payload"
  ],
  traceLoadClass: true,
  traceFindClass: true,
  printStackOnLoaderCreation: true,
  dumpDexElements: true
};

function log(message) {
  console.log("[class-loader-trace-advanced] " + message);
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

function dumpDexElements(loader) {
  try {
    const BaseDexClassLoader = Java.use("dalvik.system.BaseDexClassLoader");
    if (!Java.cast(loader, BaseDexClassLoader)) {
      return;
    }
    const loaderClass = loader.getClass();
    const pathListField = loaderClass.getSuperclass().getDeclaredField("pathList");
    pathListField.setAccessible(true);
    const pathList = pathListField.get(loader);
    const pathListClass = pathList.getClass();
    const dexElementsField = pathListClass.getDeclaredField("dexElements");
    dexElementsField.setAccessible(true);
    const dexElements = dexElementsField.get(pathList);
    const count = dexElements.length || 0;
    log("  dexElements=" + count);
    for (let index = 0; index < count; index += 1) {
      log("    element[" + index + "]=" + safeToString(dexElements[index]));
    }
  } catch (error) {
    log("  dexElements=<error:" + error + ">");
  }
}

function logLoaderCreation(label, details, loader) {
  if (!matchAny(details, CONFIG.targetDexSubstrings)) {
    return;
  }

  log(label + " " + details);
  if (loader) {
    log("  chain " + dumpLoaderChain(loader));
    if (CONFIG.dumpDexElements) {
      dumpDexElements(loader);
    }
  }
  if (CONFIG.printStackOnLoaderCreation) {
    log("  stack:\n" + stackTrace());
  }
}

Java.perform(function () {
  const DexClassLoader = Java.use("dalvik.system.DexClassLoader");
  const PathClassLoader = Java.use("dalvik.system.PathClassLoader");
  const BaseDexClassLoader = Java.use("dalvik.system.BaseDexClassLoader");
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
      logLoaderCreation("PathClassLoader", "path=" + safeToString(args[0]), this);
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
    const attachOverload = Application.attach.overload("android.content.Context");
    const result = attachOverload.call(this, context);
    const loader = context.getClassLoader();
    log("Application.attach package=" + context.getPackageName());
    log("  appLoader " + dumpLoaderChain(loader));
    if (CONFIG.dumpDexElements) {
      dumpDexElements(loader);
    }
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

  if (CONFIG.traceFindClass && BaseDexClassLoader.findClass) {
    BaseDexClassLoader.findClass.overload("java.lang.String").implementation = function (name) {
      const result = BaseDexClassLoader.findClass.overload("java.lang.String").call(this, name);
      if (matchAny(name, CONFIG.targetClassSubstrings)) {
        log("findClass " + name + " via " + safeToString(this));
      }
      return result;
    };
  }
});
