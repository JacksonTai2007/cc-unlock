"use strict";

const CONFIG = {
  suspiciousKeywords: [
    "frida",
    "gum-js-loop",
    "gmain",
    "linjector",
    "frida-agent",
    ":27042",
    ":27043"
  ],
  suspiciousPaths: [
    "/data/local/tmp",
    "frida-server",
    "re.frida.server"
  ]
};

function log(message) {
  console.log("[anti-frida-bypass] " + message);
}

function lower(value) {
  return String(value || "").toLowerCase();
}

function matchesKeyword(value) {
  const normalized = lower(value);
  return CONFIG.suspiciousKeywords.some(function (item) {
    return normalized.indexOf(lower(item)) !== -1;
  });
}

function matchesPath(value) {
  const normalized = lower(value);
  return CONFIG.suspiciousPaths.some(function (item) {
    return normalized.indexOf(lower(item)) !== -1;
  });
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

function hookLibcStringCheck(name, onLeave) {
  const address = Module.findExportByName(null, name);
  if (!address) {
    return;
  }

  Interceptor.attach(address, {
    onEnter: function (args) {
      this.left = safeReadCString(args[0]);
      this.right = safeReadCString(args[1]);
      this.block = matchesKeyword(this.left) || matchesKeyword(this.right);
    },
    onLeave: function (retval) {
      if (this.block) {
        log(name + " hide match [" + this.left + "] [" + this.right + "]");
        onLeave(retval);
      }
    }
  });
}

function hookPathProbe(name, pathIndex, patchRetval) {
  const address = Module.findExportByName(null, name);
  if (!address) {
    return;
  }

  Interceptor.attach(address, {
    onEnter: function (args) {
      this.pathValue = safeReadCString(args[pathIndex]);
      this.block = matchesPath(this.pathValue);
    },
    onLeave: function (retval) {
      if (this.block) {
        log(name + " hide path " + this.pathValue);
        patchRetval(retval);
      }
    }
  });
}

Java.perform(function () {
  const File = Java.use("java.io.File");
  const Runtime = Java.use("java.lang.Runtime");
  const ProcessBuilder = Java.use("java.lang.ProcessBuilder");

  File.exists.implementation = function () {
    const absolutePath = this.getAbsolutePath();
    if (matchesPath(absolutePath) || matchesKeyword(absolutePath)) {
      log("hide file " + absolutePath);
      return false;
    }
    return File.exists.call(this);
  };

  Runtime.exec.overloads.forEach(function (overload) {
    overload.implementation = function () {
      const args = Array.prototype.slice.call(arguments);
      const firstType = overload.argumentTypes[0].className;

      if (firstType === "java.lang.String" && matchesKeyword(args[0])) {
        log("rewrite command " + args[0]);
        args[0] = "grep";
      }

      if (firstType === "[Ljava.lang.String;") {
        const items = [];
        for (let index = 0; index < args[0].length; index += 1) {
          items.push(String(args[0][index]));
        }
        if (items.some(matchesKeyword)) {
          log("rewrite command argv " + items.join(" "));
          args[0] = Java.array("java.lang.String", ["grep"]);
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
    if (items.some(matchesKeyword)) {
      log("rewrite ProcessBuilder " + items.join(" "));
      this.command(Java.array("java.lang.String", ["grep"]));
    }
    return ProcessBuilder.start.call(this);
  };
});

hookLibcStringCheck("strstr", function (retval) {
  retval.replace(ptr(0));
});

hookLibcStringCheck("strcmp", function (retval) {
  if (retval.toInt32() === 0) {
    retval.replace(ptr(1));
  }
});

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

hookPathProbe("readlink", 0, function (retval) {
  if (retval.toInt32() >= 0) {
    retval.replace(ptr(-1));
  }
});
