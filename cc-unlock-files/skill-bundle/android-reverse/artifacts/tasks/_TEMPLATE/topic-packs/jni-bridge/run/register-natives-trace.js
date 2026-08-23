"use strict";

const CONFIG = {
  targetLibrarySubstring: "",
  targetClassSubstring: "",
  targetMethodSubstring: "",
  printJavaLoadLibrary: true,
  printNativeLoads: true,
  hookJniOnLoad: true
};

const SEEN_JNI_ONLOAD = {};

function log(message) {
  console.log("[register-natives-trace] " + message);
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

function moduleOffset(address) {
  const module = Process.findModuleByAddress(address);
  if (!module) {
    return "<no-module>";
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

function hookJavaLibraryLoads() {
  if (!CONFIG.printJavaLoadLibrary) {
    return;
  }

  Java.perform(function () {
    const System = Java.use("java.lang.System");
    const Runtime = Java.use("java.lang.Runtime");

    System.loadLibrary.overload("java.lang.String").implementation = function (name) {
      log("System.loadLibrary(" + name + ")");
      return System.loadLibrary.overload("java.lang.String").call(this, name);
    };

    System.load.overload("java.lang.String").implementation = function (pathValue) {
      log("System.load(" + pathValue + ")");
      return System.load.overload("java.lang.String").call(this, pathValue);
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
      log("JNI_OnLoad enter " + moduleName + " @" + moduleOffset(jniOnLoad));
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

        const name = basename(this.pathValue);
        log("dlopen " + this.pathValue);
        maybeHookJniOnLoad(name);
      }
    });
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

  if (candidates.length === 0) {
    return null;
  }

  return candidates[0].address;
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
      this.env = Java.vm.tryGetEnv();
      this.clazz = args[1];
      this.methods = args[2];
      this.methodCount = args[3].toInt32();
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

        log(className + " -> " + methodName + signature + " => " + moduleOffset(fnPtr));
      }
    }
  });

  log("RegisterNatives hooked @" + moduleOffset(address));
}

setImmediate(function () {
  hookNativeLoads();
  hookRegisterNatives();
  if (Java.available) {
    hookJavaLibraryLoads();
  }
});
