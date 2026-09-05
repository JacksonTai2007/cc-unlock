"use strict";

const CONFIG = {
  exports: [
    // { moduleName: "libssl.so", exportName: "SSL_write", dumpArgIndex: 1, lengthArgIndex: 2 }
  ],
  symbols: [
    // { moduleName: "libtarget.so", symbolPattern: "encrypt", maxMatches: 5 }
  ],
  moduleLoadSubstrings: [
    // "libtarget"
  ],
  dlsymSymbolSubstrings: [
    "JNI_OnLoad",
    "RegisterNatives",
    "SSL_"
  ],
  hexdumpBytes: 128,
  printBacktrace: true
};

function log(message) {
  console.log("[frida-native-template-advanced] " + message);
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

function safeHexdump(ptrValue, lengthValue) {
  if (ptrValue.isNull() || lengthValue <= 0) {
    return "";
  }

  const size = Math.min(lengthValue, CONFIG.hexdumpBytes);
  try {
    return hexdump(ptrValue, {
      offset: 0,
      length: size,
      header: false,
      ansi: false
    });
  } catch (error) {
    return "<hexdump failed: " + error + ">";
  }
}

function maybeBacktrace(context) {
  if (!CONFIG.printBacktrace) {
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

function attachAt(address, label, dumpArgIndex, lengthArgIndex) {
  Interceptor.attach(address, {
    onEnter: function (args) {
      log("enter " + label);
      maybeBacktrace(this.context);

      if (typeof dumpArgIndex === "number" && typeof lengthArgIndex === "number") {
        const lengthValue = args[lengthArgIndex].toInt32();
        log("buffer preview:\n" + safeHexdump(args[dumpArgIndex], lengthValue));
      }
    },
    onLeave: function (retval) {
      log("leave " + label + " => " + retval);
    }
  });
}

function installExportHook(spec) {
  const address = Module.findExportByName(spec.moduleName || null, spec.exportName);
  if (!address) {
    log("skip export " + (spec.moduleName || "any") + "!" + spec.exportName + " (not found)");
    return;
  }

  attachAt(address, (spec.moduleName || "any") + "!" + spec.exportName, spec.dumpArgIndex, spec.lengthArgIndex);
}

function installSymbolPattern(spec) {
  const module = Process.findModuleByName(spec.moduleName);
  if (!module) {
    log("skip module " + spec.moduleName + " (not loaded)");
    return;
  }

  const maxMatches = spec.maxMatches || 5;
  let matchCount = 0;

  module.enumerateSymbols().forEach(function (symbol) {
    if (matchCount >= maxMatches) {
      return;
    }
    if (symbol.name.indexOf(spec.symbolPattern) === -1) {
      return;
    }
    matchCount += 1;
    attachAt(symbol.address, spec.moduleName + "!" + symbol.name);
  });

  if (matchCount === 0) {
    log("skip symbol pattern " + spec.moduleName + ":" + spec.symbolPattern + " (no matches)");
  }
}

function installDlopenWatch() {
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
        if (CONFIG.moduleLoadSubstrings.length === 0 || CONFIG.moduleLoadSubstrings.some(function (item) { return this.pathValue.indexOf(item) !== -1; }, this)) {
          log("dlopen " + this.pathValue);
        }
      }
    });
  });
}

function installDlsymWatch() {
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
      if (CONFIG.dlsymSymbolSubstrings.some(function (item) { return this.symbolName.indexOf(item) !== -1; }, this)) {
        log("dlsym " + this.symbolName + " => " + retval);
      }
    }
  });
}

setImmediate(function () {
  log("loaded");
  installDlopenWatch();
  installDlsymWatch();
  CONFIG.exports.forEach(installExportHook);
  CONFIG.symbols.forEach(installSymbolPattern);
});
