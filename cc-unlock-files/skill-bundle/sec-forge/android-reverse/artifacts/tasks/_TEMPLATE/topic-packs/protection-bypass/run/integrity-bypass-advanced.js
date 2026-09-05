"use strict";

const ACTIVE_PRESET = "default";

const BASE_CONFIG = {
  safeSystemProperties: {
    "ro.debuggable": "0",
    "ro.secure": "1",
    "ro.build.tags": "release-keys"
  },
  spoofBuildFields: {
    "TAGS": "release-keys",
    "TYPE": "user"
  },
  spoofInstallerPackage: "com.android.vending",
  spoofDebugState: true,
  forceSignatureVerifyTrue: true,
  forceDigestEqualTrue: true,
  enumerateIntegrityClasses: true,
  watchClassLoadSubstrings: [
    "integrity",
    "safetynet",
    "attest",
    "verdict"
  ],
  patchRootBeer: false,
  forceBooleanMethods: [
    // { className: "com.target.Security", methodName: "isIntegrityPassed", value: true }
  ]
};

const PRESETS = {
  default: {},
  rootbeer_play_integrity: {
    watchClassLoadSubstrings: [
      "rootbeer",
      "integrity",
      "play.core.integrity",
      "attestation",
      "verdict"
    ],
    patchRootBeer: true,
    forceSignatureVerifyTrue: true,
    forceDigestEqualTrue: true
  },
  legacy_safetynet: {
    watchClassLoadSubstrings: [
      "safetynet",
      "attest",
      "jws"
    ],
    spoofInstallerPackage: "com.android.vending",
    forceSignatureVerifyTrue: true,
    forceDigestEqualTrue: false,
    patchRootBeer: true
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

function log(message) {
  console.log("[integrity-bypass-advanced] " + message);
}

function hookClassIfPresent(name, installer) {
  try {
    installer(Java.use(name));
    log("hooked " + name);
  } catch (error) {
    log("skip " + name + ": " + error);
  }
}

function installForceBoolean(spec) {
  const Target = Java.use(spec.className);
  Target[spec.methodName].overloads.forEach(function (overload) {
    overload.implementation = function () {
      log("force " + spec.className + "." + spec.methodName + " => " + spec.value);
      return spec.value;
    };
  });
}

Java.perform(function () {
  log("active preset " + ACTIVE_PRESET);
  const ActivityThread = Java.use("android.app.ActivityThread");
  const Debug = Java.use("android.os.Debug");
  const SystemProperties = Java.use("android.os.SystemProperties");
  const PackageManager = Java.use("android.app.ApplicationPackageManager");
  const Signature = Java.use("java.security.Signature");
  const MessageDigest = Java.use("java.security.MessageDigest");
  const ClassLoader = Java.use("java.lang.ClassLoader");
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
        hits.slice(0, 30).forEach(function (name) {
          log("candidate class " + name);
        });
        if (hits.length > 30) {
          log("candidate class list truncated at 30 of " + hits.length);
        }
      }
    });
  }

  if (CONFIG.watchClassLoadSubstrings.length > 0) {
    ClassLoader.loadClass.overloads.forEach(function (overload) {
      overload.implementation = function () {
        const args = Array.prototype.slice.call(arguments);
        const name = String(args[0]);
        const result = overload.apply(this, args);
        if (CONFIG.watchClassLoadSubstrings.some(function (item) { return name.toLowerCase().indexOf(item) !== -1; })) {
          log("loadClass " + name + " via " + this);
        }
        return result;
      };
    });
  }

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

  CONFIG.forceBooleanMethods.forEach(function (spec) {
    try {
      installForceBoolean(spec);
    } catch (error) {
      log("skip force boolean " + spec.className + "." + spec.methodName + ": " + error);
    }
  });

  if (CONFIG.patchRootBeer) {
    hookClassIfPresent("com.scottyab.rootbeer.RootBeer", function (RootBeer) {
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
    });
  }

  hookClassIfPresent("com.google.android.play.core.integrity.IntegrityManager", function (IntegrityManager) {
    if (IntegrityManager.requestIntegrityToken) {
      IntegrityManager.requestIntegrityToken.overloads.forEach(function (overload) {
        overload.implementation = function () {
          const args = Array.prototype.slice.call(arguments);
          log("IntegrityManager.requestIntegrityToken " + args.map(String).join(", "));
          return overload.apply(this, args);
        };
      });
    }
  });

  hookClassIfPresent("com.google.android.play.core.integrity.StandardIntegrityManager", function (StandardIntegrityManager) {
    if (StandardIntegrityManager.prepareIntegrityToken) {
      StandardIntegrityManager.prepareIntegrityToken.overloads.forEach(function (overload) {
        overload.implementation = function () {
          const args = Array.prototype.slice.call(arguments);
          log("StandardIntegrityManager.prepareIntegrityToken " + args.map(String).join(", "));
          return overload.apply(this, args);
        };
      });
    }
  });

  hookClassIfPresent("com.google.android.play.core.integrity.IntegrityTokenRequest$Builder", function (Builder) {
    if (Builder.setNonce) {
      Builder.setNonce.overloads.forEach(function (overload) {
        overload.implementation = function (nonce) {
          log("IntegrityTokenRequest.Builder.setNonce " + nonce);
          return overload.call(this, nonce);
        };
      });
    }
  });

  hookClassIfPresent("com.google.android.gms.safetynet.SafetyNetClient", function (SafetyNetClient) {
    if (SafetyNetClient.attest) {
      SafetyNetClient.attest.overloads.forEach(function (overload) {
        overload.implementation = function () {
          const args = Array.prototype.slice.call(arguments);
          log("SafetyNetClient.attest " + args.map(String).join(", "));
          return overload.apply(this, args);
        };
      });
    }
  });
});
