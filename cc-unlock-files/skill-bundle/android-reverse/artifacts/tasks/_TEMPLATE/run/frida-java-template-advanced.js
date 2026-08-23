"use strict";

const CONFIG = {
  traceTargets: [
    // { className: "javax.crypto.Cipher", methodName: "doFinal", printStack: true, dumpByteArrays: true }
  ],
  traceConstructors: [
    // { className: "java.lang.StringBuilder", printStack: false }
  ],
  forceBooleanMethods: [
    // { className: "com.target.Security", methodName: "isSafe", value: true }
  ],
  watchClassLoadSubstrings: [
    // "com.target."
  ],
  watchLoadedClassMethods: false,
  dumpByteArrays: true,
  byteArrayPreviewLength: 64,
  defaultPrintStack: true,
  printThreadInfo: true
};

function log(message) {
  console.log("[frida-java-template-advanced] " + message);
}

function currentThreadLabel() {
  try {
    const Thread = Java.use("java.lang.Thread");
    const current = Thread.currentThread();
    return current.getName() + "#" + current.getId();
  } catch (error) {
    return "<thread-error:" + error + ">";
  }
}

function currentStack() {
  const Log = Java.use("android.util.Log");
  const Throwable = Java.use("java.lang.Throwable");
  return Log.getStackTraceString(Throwable.$new());
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

function describeByteArray(value) {
  if (value === null || value === undefined) {
    return String(value);
  }

  const bytes = [];
  const limit = Math.min(value.length, CONFIG.byteArrayPreviewLength);
  for (let index = 0; index < limit; index += 1) {
    const item = value[index] & 0xff;
    bytes.push(("0" + item.toString(16)).slice(-2));
  }

  return "[B len=" + value.length + " hex=" + bytes.join(" ") + (value.length > limit ? " ..." : "") + "]";
}

function looksLikeByteArray(value) {
  return value !== null && value !== undefined && typeof value.length === "number" && safeToString(value.$className || "").indexOf("[B") !== -1;
}

function describeValue(value, dumpByteArrays) {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  try {
    if (dumpByteArrays && looksLikeByteArray(value)) {
      return describeByteArray(value);
    }
    if (value.$className) {
      return value.$className + "=" + safeToString(value);
    }
  } catch (error) {
    return "<describe failed: " + error + ">";
  }

  return safeToString(value);
}

function printPrefix(label, printStack) {
  log(label);
  if (CONFIG.printThreadInfo) {
    log("  thread=" + currentThreadLabel());
  }
  if (printStack) {
    log("  stack:\n" + currentStack());
  }
}

function traceMethod(spec) {
  const Target = Java.use(spec.className);
  const overloads = Target[spec.methodName].overloads;

  overloads.forEach(function (overload) {
    const signature = overload.argumentTypes.map(function (item) {
      return item.className;
    }).join(", ");
    const printStack = spec.printStack === true || (spec.printStack !== false && CONFIG.defaultPrintStack);
    const dumpByteArrays = spec.dumpByteArrays === true || (spec.dumpByteArrays !== false && CONFIG.dumpByteArrays);

    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      printPrefix("enter " + spec.className + "." + spec.methodName + "(" + signature + ")", printStack);
      args.forEach(function (arg, index) {
        log("  arg[" + index + "]=" + describeValue(arg, dumpByteArrays));
      });
      const result = overload.apply(this, args);
      log("  ret=" + describeValue(result, dumpByteArrays));
      return result;
    };
  });
}

function traceConstructor(spec) {
  const Target = Java.use(spec.className);
  const printStack = spec.printStack === true || (spec.printStack !== false && CONFIG.defaultPrintStack);

  Target.$init.overloads.forEach(function (overload) {
    const signature = overload.argumentTypes.map(function (item) {
      return item.className;
    }).join(", ");

    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      printPrefix("new " + spec.className + "(" + signature + ")", printStack);
      args.forEach(function (arg, index) {
        log("  ctorArg[" + index + "]=" + describeValue(arg, true));
      });
      return overload.apply(this, args);
    };
  });
}

function forceBooleanMethod(spec) {
  const Target = Java.use(spec.className);
  Target[spec.methodName].overloads.forEach(function (overload) {
    overload.implementation = function () {
      log("force " + spec.className + "." + spec.methodName + " => " + spec.value);
      return spec.value;
    };
  });
}

function installClassLoadWatch() {
  if (CONFIG.watchClassLoadSubstrings.length === 0) {
    return;
  }

  const ClassLoader = Java.use("java.lang.ClassLoader");
  ClassLoader.loadClass.overloads.forEach(function (overload) {
    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      const name = String(args[0]);
      const result = overload.apply(this, args);
      if (CONFIG.watchClassLoadSubstrings.some(function (item) { return name.indexOf(item) !== -1; })) {
        log("loadClass " + name + " via " + safeToString(this));
        if (CONFIG.watchLoadedClassMethods) {
          try {
            const Target = Java.use(name);
            log("  declaredMethods=" + Target.class.getDeclaredMethods().length);
          } catch (error) {
            log("  declaredMethods=<error:" + error + ">");
          }
        }
      }
      return result;
    };
  });
}

Java.perform(function () {
  log("loaded");

  CONFIG.traceTargets.forEach(function (spec) {
    try {
      traceMethod(spec);
    } catch (error) {
      log("skip trace target " + spec.className + "." + spec.methodName + ": " + error);
    }
  });

  CONFIG.traceConstructors.forEach(function (spec) {
    try {
      traceConstructor(spec);
    } catch (error) {
      log("skip constructor target " + spec.className + ": " + error);
    }
  });

  CONFIG.forceBooleanMethods.forEach(function (spec) {
    try {
      forceBooleanMethod(spec);
    } catch (error) {
      log("skip force boolean " + spec.className + "." + spec.methodName + ": " + error);
    }
  });

  installClassLoadWatch();
});
