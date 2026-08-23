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
  }
};

function log(message) {
  console.log("[anti-root-bypass] " + message);
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
});
