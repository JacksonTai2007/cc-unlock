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

// --- /proc/self/maps 内存扫描绕过 ---
// 某些检测不通过 open+strstr，而是直接 mmap + 内存搜索特征字符串
// 绕过：hook read，当读取 /proc/self/maps 时过滤含 frida 特征的行
Interceptor.attach(Module.findExportByName(null, "read"), {
  onEnter: function (args) {
    this.fd = args[0].toInt32();
    this.buf = args[1];
    this.size = args[2].toInt32();
  },
  onLeave: function (retval) {
    if (retval.toInt32() <= 0) return;
    try {
      var content = Memory.readUtf8String(this.buf, retval.toInt32());
      if (content && matchesKeyword(content)) {
        // 过滤含 frida 特征的行，保留其他行
        var filtered = content.split("\n").filter(function (line) {
          return !matchesKeyword(line);
        }).join("\n");
        if (filtered.length < retval.toInt32()) {
          Memory.writeUtf8String(this.buf, filtered);
          retval.replace(ptr(filtered.length));
          log("read: filtered maps content");
        }
      }
    } catch (e) { /* not a string buffer, ignore */ }
  }
});

// --- pthread_create 线程名清理 ---
// 检测方通过 pthread_getname_np 或 /proc/self/task/*/comm 读取线程名
// 绕过：hook pthread_setname_np 拦截设置 Frida 特征线程名
var pthread_setname_np = Module.findExportByName(null, "pthread_setname_np");
if (pthread_setname_np) {
  Interceptor.attach(pthread_setname_np, {
    onEnter: function (args) {
      var name = safeReadCString(args[1]);
      if (name && matchesKeyword(name)) {
        var clean = "worker-" + Process.getCurrentThreadId();
        this._cleanName = Memory.allocUtf8String(clean); // anchor to prevent GC
        args[1] = this._cleanName;
        log("pthread_setname_np: renamed '" + name + "' -> '" + clean + "'");
      }
    }
  });
}

// --- 端口扫描绕过 ---
// 检测方 connect 到 27042/27043 等默认端口判断 frida-server
// 绕过：hook connect，对默认端口返回 ECONNREFUSED
var connect_addr = Module.findExportByName(null, "connect");
if (connect_addr) {
  Interceptor.attach(connect_addr, {
    onEnter: function (args) {
      var sockaddr = args[1];
      var family = Memory.readU16(sockaddr);
      if (family === 2) { // AF_INET
        var port = (Memory.readU8(sockaddr.add(2)) << 8) | Memory.readU8(sockaddr.add(3));
        if (port === 27042 || port === 27043) {
          this.block = true;
          log("connect: blocked port " + port);
        }
      }
    },
    onLeave: function (retval) {
      if (this.block) {
        retval.replace(ptr(-1));
      }
    }
  });
}
