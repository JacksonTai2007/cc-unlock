"use strict";

const ACTIVE_PRESET = "default";

const BASE_CONFIG = {
  suspiciousKeywords: [
    "frida",
    "gum-js-loop",
    "gmain",
    "linjector",
    "frida-agent",
    "re.frida.server",
    ":27042",
    ":27043"
  ],
  suspiciousPaths: [
    "/data/local/tmp",
    "frida-server",
    "/proc/self/maps",
    "/proc/self/task"
  ],
  suspiciousPorts: [
    27042,
    27043
  ],
  patchPtrace: false,
  blockLocalPortScan: true
};

const PRESETS = {
  default: {},
  cronet_multiprocess: {
    suspiciousKeywords: [
      "pool-frida",
      "gum-js-loop",
      "gmain",
      "frida-helper",
      "frida-agent"
    ],
    suspiciousPaths: [
      "/proc/net/tcp",
      "/proc/net/tcp6",
      "/proc/net/unix",
      "/proc/self/status",
      "/proc/self/cgroup"
    ],
    suspiciousPorts: [
      27042,
      27043,
      23946
    ],
    patchPtrace: true,
    blockLocalPortScan: true
  },
  stealth_spawn_child: {
    suspiciousKeywords: [
      "frida",
      "gum-js-loop",
      "gmain",
      "linjector",
      "re.frida.server",
      "zygiskfrida"
    ],
    suspiciousPaths: [
      "/data/local/tmp",
      "/proc/self/maps",
      "/proc/self/task",
      "/proc/self/mounts"
    ],
    suspiciousPorts: [
      27042,
      27043
    ],
    patchPtrace: true,
    blockLocalPortScan: true
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
  console.log("[anti-frida-bypass-advanced] " + message);
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

function ntohs(value) {
  return ((value & 0xff) << 8) | ((value >> 8) & 0xff);
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
      this.block = matchesPath(this.pathValue) || matchesKeyword(this.pathValue);
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

function hookConnect() {
  const address = Module.findExportByName(null, "connect");
  if (!address || !CONFIG.blockLocalPortScan) {
    return;
  }

  Interceptor.attach(address, {
    onEnter: function (args) {
      this.block = false;
      const sockaddr = args[1];
      if (!sockaddr || sockaddr.isNull()) {
        return;
      }

      try {
        const family = Memory.readU16(sockaddr);
        if (family !== 2 && family !== 10) {
          return;
        }
        const port = ntohs(Memory.readU16(sockaddr.add(2)));
        this.block = CONFIG.suspiciousPorts.indexOf(port) !== -1;
        if (this.block) {
          log("block connect port " + port);
        }
      } catch (error) {
        log("connect inspect failed: " + error);
      }
    },
    onLeave: function (retval) {
      if (this.block) {
        retval.replace(ptr(-1));
      }
    }
  });
}

function hookPtrace() {
  const address = Module.findExportByName(null, "ptrace");
  if (!address || !CONFIG.patchPtrace) {
    return;
  }

  Interceptor.attach(address, {
    onEnter: function (args) {
      this.request = args[0].toInt32();
    },
    onLeave: function (retval) {
      log("ptrace request " + this.request + " => 0");
      retval.replace(ptr(0));
    }
  });
}

Java.perform(function () {
  log("active preset " + ACTIVE_PRESET);
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

hookPathProbe("fopen", 0, function (retval) {
  if (!retval.isNull()) {
    retval.replace(ptr(0));
  }
});

hookConnect();
hookPtrace();
