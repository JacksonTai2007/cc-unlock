"use strict";

const CONFIG = {
  traceTargets: [
    // { className: "javax.crypto.Cipher", methodName: "doFinal" },
    // { className: "okhttp3.RealCall", methodName: "execute", printStack: true }
  ],
  traceConstructors: [
    // "java.lang.StringBuilder"
  ],
  watchClassLoadSubstrings: [
    // "com.target."
  ],
  includeArgs: true,
  includeReturnValue: true,
  defaultPrintStack: false
};

function log(message) {
  console.log("[frida-java-template] " + message);
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

function describeValue(value) {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  try {
    if (value.$className) {
      return value.$className + "=" + safeToString(value);
    }
  } catch (error) {
    return "<describe failed: " + error + ">";
  }

  return safeToString(value);
}

function currentStack() {
  const Log = Java.use("android.util.Log");
  const Throwable = Java.use("java.lang.Throwable");
  return Log.getStackTraceString(Throwable.$new());
}

function traceMethod(className, methodName, printStack) {
  const Target = Java.use(className);
  const overloads = Target[methodName].overloads;

  overloads.forEach(function (overload) {
    const signature = overload.argumentTypes.map(function (item) {
      return item.className;
    }).join(", ");

    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      log("enter " + className + "." + methodName + "(" + signature + ")");

      if (CONFIG.includeArgs) {
        args.forEach(function (arg, index) {
          log("  arg[" + index + "]=" + describeValue(arg));
        });
      }

      if (printStack) {
        log("  stack:\n" + currentStack());
      }

      const result = overload.apply(this, args);

      if (CONFIG.includeReturnValue) {
        log("  ret=" + describeValue(result));
      }

      return result;
    };
  });
}

function traceConstructors(className) {
  const Target = Java.use(className);
  Target.$init.overloads.forEach(function (overload) {
    const signature = overload.argumentTypes.map(function (item) {
      return item.className;
    }).join(", ");

    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      log("new " + className + "(" + signature + ")");
      args.forEach(function (arg, index) {
        log("  ctorArg[" + index + "]=" + describeValue(arg));
      });
      return overload.apply(this, args);
    };
  });
}

function installClassLoadWatch() {
  if (CONFIG.watchClassLoadSubstrings.length === 0) {
    return;
  }

  const ClassLoader = Java.use("java.lang.ClassLoader");
  const overload = ClassLoader.loadClass.overload("java.lang.String");

  overload.implementation = function (name) {
    const result = overload.call(this, name);
    if (CONFIG.watchClassLoadSubstrings.some(function (item) { return name.indexOf(item) !== -1; })) {
      log("classLoader " + this + " loaded " + name);
    }
    return result;
  };
}

Java.perform(function () {
  log("loaded");

  CONFIG.traceTargets.forEach(function (target) {
    try {
      traceMethod(
        target.className,
        target.methodName,
        target.printStack === true || (target.printStack !== false && CONFIG.defaultPrintStack)
      );
    } catch (error) {
      log("skip target " + target.className + "." + target.methodName + ": " + error);
    }
  });

  CONFIG.traceConstructors.forEach(function (className) {
    try {
      traceConstructors(className);
    } catch (error) {
      log("skip constructor trace " + className + ": " + error);
    }
  });

  installClassLoadWatch();
});
