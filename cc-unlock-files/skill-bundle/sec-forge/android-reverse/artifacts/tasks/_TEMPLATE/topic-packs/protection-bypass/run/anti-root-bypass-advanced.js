"use strict";

const CONFIG = {
  suspiciousPackages: [
    "com.topjohnwu.magisk",
    "com.koushikdutta.superuser",
    "eu.chainfire.supersu",
    "com.devadvance.rootcloak"
  ],
  suspiciousBinaries: [
    "/system/bin/su",
    "/system/xbin/su",
    "/sbin/su",
    "/su/bin/su",
    "/system/bin/busybox",
    "/system/xbin/busybox",
    "/system/app/Superuser.apk",
    "/system/etc/init.d"
  ],
  suspiciousCommands: [
    "su",
    "which su",
    "busybox",
    "magisk",
    "getprop",
    "mount",
    "id"
  ],
  safeSystemProperties: {
    "ro.debuggable": "0",
    "ro.secure": "1",
    "ro.build.tags": "release-keys",
    "service.adb.root": "0"
  },
  spoofBuildFields: {
    "TAGS": "release-keys",
    "TYPE": "user"
  },
  patchNativeFileChecks: true,
  patchNativePropertyGet: true,
  patchRootBeer: true
};

function log(message) {
  console.log("[anti-root-bypass-advanced] " + message);
}

function lower(value) {
  return String(value || "").toLowerCase();
}

function pathLooksRoot(pathValue) {
  const normalized = lower(pathValue);
  return CONFIG.suspiciousBinaries.some(function (item) {
    return normalized.indexOf(lower(item)) !== -1;
  });
}

function packageLooksRoot(name) {
  const normalized = lower(name);
  return CONFIG.suspiciousPackages.some(function (item) {
    return normalized === lower(item);
  });
}

function commandLooksRoot(commandValue) {
  const normalized = lower(commandValue);
  return CONFIG.suspiciousCommands.some(function (item) {
    return normalized.indexOf(lower(item)) !== -1;
  });
}

function patchCommandArray(items) {
  let changed = false;
  const patched = items.map(function (item, index) {
    const stringValue = String(item);
    if (index === 0 && commandLooksRoot(stringValue)) {
      changed = true;
      return "grep";
    }
    return stringValue;
  });

  return {
    changed: changed,
    patched: patched
  };
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

function hookPathProbe(name, pathIndex, patchRetval) {
  const address = Module.findExportByName(null, name);
  if (!address) {
    return;
  }

  Interceptor.attach(address, {
    onEnter: function (args) {
      this.pathValue = safeReadCString(args[pathIndex]);
      this.block = pathLooksRoot(this.pathValue);
    },
    onLeave: function (retval) {
      if (!this.block) {
        return;
      }
      log(name + " hide path " + this.pathValue);
      patchRetval(retval);
    }
  });
}

function hookSystemPropertyGet() {
  const address = Module.findExportByName(null, "__system_property_get");
  if (!address) {
    return;
  }

  Interceptor.attach(address, {
    onEnter: function (args) {
      this.key = safeReadCString(args[0]);
      this.buffer = args[1];
    },
    onLeave: function (retval) {
      if (!Object.prototype.hasOwnProperty.call(CONFIG.safeSystemProperties, this.key)) {
        return;
      }
      const value = CONFIG.safeSystemProperties[this.key];
      Memory.writeUtf8String(this.buffer, value);
      retval.replace(ptr(value.length));
      log("__system_property_get " + this.key + " => " + value);
    }
  });
}

Java.perform(function () {
  const File = Java.use("java.io.File");
  const Runtime = Java.use("java.lang.Runtime");
  const ProcessBuilder = Java.use("java.lang.ProcessBuilder");
  const SystemProperties = Java.use("android.os.SystemProperties");
  const PackageManager = Java.use("android.app.ApplicationPackageManager");
  const NameNotFoundException = Java.use("android.content.pm.PackageManager$NameNotFoundException");

  File.exists.implementation = function () {
    const absolutePath = this.getAbsolutePath();
    if (pathLooksRoot(absolutePath)) {
      log("hide file " + absolutePath);
      return false;
    }
    return File.exists.call(this);
  };

  File.canRead.implementation = function () {
    const absolutePath = this.getAbsolutePath();
    if (pathLooksRoot(absolutePath)) {
      log("hide readable file " + absolutePath);
      return false;
    }
    return File.canRead.call(this);
  };

  SystemProperties.get.overloads.forEach(function (overload) {
    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      const key = String(args[0]);
      if (Object.prototype.hasOwnProperty.call(CONFIG.safeSystemProperties, key)) {
        const safeValue = CONFIG.safeSystemProperties[key];
        log("spoof property " + key + " => " + safeValue);
        return safeValue;
      }
      return overload.apply(this, args);
    };
  });

  const Build = Java.use("android.os.Build");
  Object.keys(CONFIG.spoofBuildFields).forEach(function (fieldName) {
    try {
      Build[fieldName].value = CONFIG.spoofBuildFields[fieldName];
      log("spoof Build." + fieldName + " => " + CONFIG.spoofBuildFields[fieldName]);
    } catch (error) {
      log("skip Build." + fieldName + ": " + error);
    }
  });

  Runtime.exec.overloads.forEach(function (overload) {
    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      const firstType = overload.argumentTypes[0].className;

      if (firstType === "java.lang.String") {
        if (commandLooksRoot(args[0])) {
          log("rewrite command " + args[0]);
          args[0] = "grep";
        }
      } else if (firstType === "[Ljava.lang.String;") {
        const patched = patchCommandArray(args[0]);
        if (patched.changed) {
          log("rewrite command argv " + patched.patched.join(" "));
          args[0] = Java.array("java.lang.String", patched.patched);
        }
      }

      return overload.apply(this, args);
    };
  });

  ProcessBuilder.start.implementation = function () {
    const current = this.command();
    const items = [];
    for (let index = 0; index < current.size(); index += 1) {
      items.push(String(current.get(index)));
    }
    const patched = patchCommandArray(items);
    if (patched.changed) {
      log("rewrite ProcessBuilder " + items.join(" "));
      this.command(Java.array("java.lang.String", patched.patched));
    }
    return ProcessBuilder.start.call(this);
  };

  PackageManager.getPackageInfo.overloads.forEach(function (overload) {
    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      const packageName = String(args[0]);
      if (packageLooksRoot(packageName)) {
        log("hide package " + packageName);
        throw NameNotFoundException.$new(packageName);
      }
      return overload.apply(this, args);
    };
  });

  PackageManager.getApplicationInfo.overloads.forEach(function (overload) {
    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      const packageName = String(args[0]);
      if (packageLooksRoot(packageName)) {
        log("hide app info " + packageName);
        throw NameNotFoundException.$new(packageName);
      }
      return overload.apply(this, args);
    };
  });

  if (CONFIG.patchRootBeer) {
    try {
      const RootBeer = Java.use("com.scottyab.rootbeer.RootBeer");
      RootBeer.class.getDeclaredMethods().forEach(function (method) {
        const name = method.getName();
        if (name.indexOf("is") !== 0 && name.indexOf("check") !== 0) {
          return;
        }
        if (String(method.getReturnType().getName()) !== "boolean") {
          return;
        }
        RootBeer[name].overloads.forEach(function (overload) {
          overload.implementation = function () {
            log("RootBeer." + name + " => false");
            return false;
          };
        });
      });
    } catch (error) {
      log("RootBeer unavailable: " + error);
    }
  }
});

if (CONFIG.patchNativeFileChecks) {
  hookPathProbe("open", 0, function (retval) {
    if (retval.toInt32() >= 0) {
      retval.replace(ptr(-1));
    }
  });

  hookPathProbe("openat", 1, function (retval) {
    if (retval.toInt32() >= 0) {
      retval.replace(ptr(-1));
    }
  });

  hookPathProbe("access", 0, function (retval) {
    if (retval.toInt32() === 0) {
      retval.replace(ptr(-1));
    }
  });

  hookPathProbe("stat", 0, function (retval) {
    if (retval.toInt32() === 0) {
      retval.replace(ptr(-1));
    }
  });

  hookPathProbe("lstat", 0, function (retval) {
    if (retval.toInt32() === 0) {
      retval.replace(ptr(-1));
    }
  });

  hookPathProbe("fopen", 0, function (retval) {
    if (!retval.isNull()) {
      retval.replace(ptr(0));
    }
  });
}

if (CONFIG.patchNativePropertyGet) {
  hookSystemPropertyGet();
}
