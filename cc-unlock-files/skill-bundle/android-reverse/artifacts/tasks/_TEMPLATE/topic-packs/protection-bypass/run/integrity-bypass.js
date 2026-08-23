"use strict";

const CONFIG = {
  forceSignatureVerifyTrue: true,
  forceDigestEqualTrue: false,
  spoofInstallerPackage: "com.android.vending",
  spoofDebugState: true,
  enumerateIntegrityClasses: true
};

function log(message) {
  console.log("[integrity-bypass] " + message);
}

function classAvailable(name) {
  try {
    Java.use(name);
    return true;
  } catch (error) {
    return false;
  }
}

Java.perform(function () {
  const ActivityThread = Java.use("android.app.ActivityThread");
  const Debug = Java.use("android.os.Debug");
  const PackageManager = Java.use("android.app.ApplicationPackageManager");
  const Signature = Java.use("java.security.Signature");
  const MessageDigest = Java.use("java.security.MessageDigest");
  const currentApplication = ActivityThread.currentApplication();
  const context = currentApplication ? currentApplication.getApplicationContext() : null;
  const selfPackage = context ? String(context.getPackageName()) : "";

  if (CONFIG.enumerateIntegrityClasses) {
    const hits = [];
    Java.enumerateLoadedClasses({
      onMatch: function (name) {
        const normalized = name.toLowerCase();
        if (
          normalized.indexOf("integrity") !== -1 ||
          normalized.indexOf("safetynet") !== -1 ||
          normalized.indexOf("attest") !== -1 ||
          normalized.indexOf("verdict") !== -1
        ) {
          hits.push(name);
        }
      },
      onComplete: function () {
        hits.slice(0, 20).forEach(function (name) {
          log("candidate class " + name);
        });
        if (hits.length > 20) {
          log("candidate class list truncated at 20 of " + hits.length);
        }
      }
    });
  }

  if (CONFIG.spoofDebugState) {
    Debug.isDebuggerConnected.implementation = function () {
      log("Debug.isDebuggerConnected => false");
      return false;
    };

    Debug.waitingForDebugger.implementation = function () {
      log("Debug.waitingForDebugger => false");
      return false;
    };
  }

  PackageManager.getInstallerPackageName.overload("java.lang.String").implementation = function (packageName) {
    const result = PackageManager.getInstallerPackageName.overload("java.lang.String").call(this, packageName);
    if (!selfPackage || String(packageName) !== selfPackage) {
      return result;
    }
    log("spoof installer package for " + packageName + " => " + CONFIG.spoofInstallerPackage);
    return CONFIG.spoofInstallerPackage;
  };

  PackageManager.getPackageInfo.overloads.forEach(function (overload) {
    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      const packageName = String(args[0]);
      const result = overload.apply(this, args);
      if (selfPackage && packageName === selfPackage) {
        log("self getPackageInfo flags=" + args.slice(1).map(String).join(", "));
      }
      return result;
    };
  });

  if (CONFIG.forceSignatureVerifyTrue) {
    Signature.verify.overloads.forEach(function (overload) {
      overload.implementation = function () {
        const args = Array.prototype.slice.call(arguments);
        const result = overload.apply(this, args);
        log("Signature.verify intercepted => true (was " + result + ")");
        return true;
      };
    });
  }

  if (CONFIG.forceDigestEqualTrue) {
    MessageDigest.isEqual.overload("[B", "[B").implementation = function () {
      log("MessageDigest.isEqual => true");
      return true;
    };
  }

  [
    "com.google.android.play.core.integrity.IntegrityManager",
    "com.google.android.gms.safetynet.SafetyNetClient"
  ].forEach(function (name) {
    if (classAvailable(name)) {
      log("loaded integrity facade " + name);
    }
  });
});
