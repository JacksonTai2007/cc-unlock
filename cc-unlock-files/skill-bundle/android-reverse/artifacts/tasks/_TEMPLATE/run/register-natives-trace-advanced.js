"use strict";

const ACTIVE_PRESET = "default";

const BASE_CONFIG = {
  targetLibrarySubstring: "",
  targetClassSubstring: "",
  targetMethodSubstring: "",
  printJavaLoadLibrary: true,
  printNativeLoads: true,
  printDlsym: true,
  hookJniOnLoad: true,
  printBacktraceOnRegisterNatives: true,
  maxMethodsPerCall: 128,
  includeAnonymousFns: true,
  watchClassLoadSubstrings: [],
  printNativeDeclarationsOnClassLoad: false
};

const PRESETS = {
  default: {},
  shell_dynamic_registration: {
    printDlsym: true,
    hookJniOnLoad: true,
    printBacktraceOnRegisterNatives: true,
    includeAnonymousFns: true,
    watchClassLoadSubstrings: [
      "StubApp",
      "Shell",
      "ProxyApplication",
      "Application"
    ],
    printNativeDeclarationsOnClassLoad: true
  },
  shell_dynamic_registration_multiprocess: {
    printDlsym: true,
    hookJniOnLoad: true,
    printBacktraceOnRegisterNatives: true,
    includeAnonymousFns: true,
    watchClassLoadSubstrings: [
      "StubApp",
      "Shell",
      "ProxyApplication",
      "Application",
      ":remote"
    ],
    printNativeDeclarationsOnClassLoad: true
  }
};

function uniq(values) {
  return Array.from(new Set((values || []).map(function (item) { return String(item); })));
}

function mergeConfig(base, extra) {
  const next = Object.assign({}, base);
  Object.keys(extra || {}).forEach(function (key) {
    const baseValue = next[key];
    const extraValue = extra[key];

    if (Array.isArray(baseValue) && Array.isArray(extraValue)) {
      next[key] = uniq(baseValue.concat(extraValue));
      return;
    }

    if (
      baseValue &&
      extraValue &&
      typeof baseValue === "object" &&
      typeof extraValue === "object" &&
      !Array.isArray(baseValue) &&
      !Array.isArray(extraValue)
    ) {
      next[key] = mergeConfig(baseValue, extraValue);
      return;
    }

    next[key] = extraValue;
  });
  return next;
}

const CONFIG = mergeConfig(BASE_CONFIG, PRESETS[ACTIVE_PRESET] || {});

const SEEN_JNI_ONLOAD = {};

function log(message) {
  console.log("[register-natives-trace-advanced] " + message);
}

function safeReadCString(pointerValue) {
  if (!pointerValue || pointerValue.isNull()) {
    return "";
  }

  try {
    return Memory.readCString(pointerValue);
  } catch (error) {
    return "";
  }
}

function basename(pathValue) {
  if (!pathValue) {
    return "";
  }
  const parts = pathValue.split("/");
  return parts[parts.length - 1];
}

function moduleDescriptor(address) {
  const module = Process.findModuleByAddress(address);
  if (!module) {
    return CONFIG.includeAnonymousFns ? "<anonymous>@" + address : "<anonymous>";
  }

  return module.name + "+0x" + address.sub(module.base).toString(16);
}

function matchesFilter(value, needle) {
  if (!needle) {
    return true;
  }
  return String(value || "").toLowerCase().indexOf(needle.toLowerCase()) !== -1;
}

function shouldLog(record) {
  return matchesFilter(record.library, CONFIG.targetLibrarySubstring) &&
    matchesFilter(record.className, CONFIG.targetClassSubstring) &&
    matchesFilter(record.methodName, CONFIG.targetMethodSubstring);
}

function maybeBacktrace(context) {
  if (!CONFIG.printBacktraceOnRegisterNatives) {
    return;
  }

  try {
    const trace = Thread.backtrace(context, Backtracer.ACCURATE)
      .map(DebugSymbol.fromAddress)
      .join("\n");
    log("backtrace:\n" + trace);
  } catch (error) {
    log("backtrace failed: " + error);
  }
}

function watchJavaClassLoads() {
  if (!Java.available || CONFIG.watchClassLoadSubstrings.length === 0) {
    return;
  }

  Java.perform(function () {
    const ClassLoader = Java.use("java.lang.ClassLoader");
    ClassLoader.loadClass.overloads.forEach(function (overload) {
      overload.implementation = function () {
        const args = Array.prototype.slice.call(arguments);
        const name = String(args[0]);
        const result = overload.apply(this, args);

        if (!CONFIG.watchClassLoadSubstrings.some(function (item) { return name.indexOf(item) !== -1; })) {
          return result;
        }

        log("loadClass " + name + " via " + this);

        if (CONFIG.printNativeDeclarationsOnClassLoad) {
          try {
            const Target = Java.use(name);
            const declaredMethods = Target.class.getDeclaredMethods();
            for (let index = 0; index < declaredMethods.length; index += 1) {
              const method = declaredMethods[index];
              if ((method.getModifiers() & 0x0100) !== 0) {
                log("  native decl " + method.toString());
              }
            }
          } catch (error) {
            log("  native decl inspect failed: " + error);
          }
        }

        return result;
      };
    });
  });
}

function hookJavaLibraryLoads() {
  if (!CONFIG.printJavaLoadLibrary || !Java.available) {
    return;
  }

  Java.perform(function () {
    const System = Java.use("java.lang.System");
    const Runtime = Java.use("java.lang.Runtime");
    const loadLibraryOverload = System.loadLibrary.overload("java.lang.String");
    const loadOverload = System.load.overload("java.lang.String");

    loadLibraryOverload.implementation = function (name) {
      log("System.loadLibrary(" + name + ")");
      return loadLibraryOverload.call(this, name);
    };

    loadOverload.implementation = function (pathValue) {
      log("System.load(" + pathValue + ")");
      return loadOverload.call(this, pathValue);
    };

    if (Runtime.loadLibrary0) {
      Runtime.loadLibrary0.overloads.forEach(function (overload) {
        overload.implementation = function () {
          const args = Array.prototype.slice.call(arguments);
          log("Runtime.loadLibrary0(" + args.map(String).join(", ") + ")");
          return overload.apply(this, args);
        };
      });
    }
  });
}

function maybeHookJniOnLoad(moduleName) {
  if (!CONFIG.hookJniOnLoad || !moduleName) {
    return;
  }

  const jniOnLoad = Module.findExportByName(moduleName, "JNI_OnLoad");
  if (!jniOnLoad) {
    return;
  }

  const key = jniOnLoad.toString();
  if (SEEN_JNI_ONLOAD[key]) {
    return;
  }
  SEEN_JNI_ONLOAD[key] = true;

  Interceptor.attach(jniOnLoad, {
    onEnter: function () {
      log("JNI_OnLoad enter " + moduleName + " @" + moduleDescriptor(jniOnLoad));
    },
    onLeave: function (retval) {
      log("JNI_OnLoad leave " + moduleName + " => " + retval);
    }
  });
}

function hookNativeLoads() {
  if (!CONFIG.printNativeLoads) {
    return;
  }

  [
    Module.findExportByName(null, "android_dlopen_ext"),
    Module.findExportByName(null, "dlopen")
  ].filter(Boolean).forEach(function (address) {
    Interceptor.attach(address, {
      onEnter: function (args) {
        this.pathValue = safeReadCString(args[0]);
      },
      onLeave: function () {
        if (!this.pathValue) {
          return;
        }
        log("dlopen " + this.pathValue);
        maybeHookJniOnLoad(basename(this.pathValue));
      }
    });
  });
}

function hookDlsym() {
  if (!CONFIG.printDlsym) {
    return;
  }

  const address = Module.findExportByName(null, "dlsym");
  if (!address) {
    return;
  }

  Interceptor.attach(address, {
    onEnter: function (args) {
      this.symbolName = safeReadCString(args[1]);
    },
    onLeave: function (retval) {
      if (!this.symbolName) {
        return;
      }
      if (
        this.symbolName.indexOf("JNI_OnLoad") !== -1 ||
        this.symbolName.indexOf("RegisterNatives") !== -1 ||
        this.symbolName.indexOf("Java_") !== -1
      ) {
        log("dlsym " + this.symbolName + " => " + retval);
      }
    }
  });
}

function findRegisterNatives() {
  const libart = Process.findModuleByName("libart.so");
  if (!libart) {
    return null;
  }

  const candidates = libart.enumerateSymbols().filter(function (symbol) {
    return symbol.name.indexOf("RegisterNatives") !== -1 && symbol.name.indexOf("CheckJNI") === -1;
  });

  return candidates.length > 0 ? candidates[0].address : null;
}

function hookRegisterNatives() {
  const address = findRegisterNatives();
  if (!address) {
    log("RegisterNatives not found");
    return;
  }

  const itemSize = Process.pointerSize * 3;

  Interceptor.attach(address, {
    onEnter: function (args) {
      this.contextRef = this.context;
      this.env = Java.available ? Java.vm.tryGetEnv() : null;
      this.clazz = args[1];
      this.methods = args[2];
      this.methodCount = Math.min(args[3].toInt32(), CONFIG.maxMethodsPerCall);
    },
    onLeave: function () {
      let className = "<unresolved-class>";

      try {
        if (this.env) {
          className = this.env.getClassName(this.clazz);
        }
      } catch (error) {
        className = "<class-error:" + error + ">";
      }

      log("RegisterNatives class=" + className + " count=" + this.methodCount);
      maybeBacktrace(this.contextRef);

      for (let index = 0; index < this.methodCount; index += 1) {
        const item = this.methods.add(index * itemSize);
        const methodName = safeReadCString(Memory.readPointer(item));
        const signature = safeReadCString(Memory.readPointer(item.add(Process.pointerSize)));
        const fnPtr = Memory.readPointer(item.add(Process.pointerSize * 2));
        const module = Process.findModuleByAddress(fnPtr);
        const record = {
          library: module ? module.name : "",
          className: className,
          methodName: methodName
        };

        if (!shouldLog(record)) {
          continue;
        }

        log("  " + className + " -> " + methodName + signature + " => " + moduleDescriptor(fnPtr));
      }
    }
  });

  log("RegisterNatives hooked @" + moduleDescriptor(address));
}

setImmediate(function () {
  log("active preset " + ACTIVE_PRESET);
  hookNativeLoads();
  hookDlsym();
  hookRegisterNatives();
  hookJavaLibraryLoads();
  watchJavaClassLoads();
});
