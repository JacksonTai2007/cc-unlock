## Frida-on-Windows：PE/EXE/DLL Hook 能力

### 快速导航

- 环境与附加：搜 `### 环境检查清单`、`### 附加模式`
- 常用 Hook 模式：搜 `### Hook 模式库`
- 反调试 / Anti-Frida / ETW：搜 `### PE 反调试完整绕过脚本`、`### Anti-Frida 检测绕过块`、`### ETW / EDR 遥测绕过块`
- 参数与行为捕获：搜 `### PE 加密参数捕获`、`### PE 网络 + 注册表 + 文件 I/O 监控`
- 故障排查：搜 `### PE Frida 故障排查决策树`

### 目录

1. 环境检查清单
2. 附加模式
3. Hook 模式库
4. PE 反调试完整绕过脚本
5. Anti-Frida 检测绕过块
6. ETW / EDR 遥测绕过块
7. PE 加密参数捕获
8. PE 网络 + 注册表 + 文件 I/O 监控
9. PE Frida 故障排查决策树

### 环境检查清单
```
[ ] frida --version confirms install; arch matches target (x86 vs x64)
[ ] Local same-session: no frida-server; frida -p <pid> directly
[ ] Cross-session/elevated: frida-server.exe at same or higher privilege
[ ] Gadget mode: frida-gadget.dll renamed to imported DLL
[ ] AV/EDR: whitelist frida-agent in analysis VM; or use gadget mode
[ ] Network: firewall target if live traffic not in scope
[ ] Anti-Frida: run Anti-Frida Bypass Block before all other hooks
[ ] WOW64: confirm Process.pointerSize === 4 for 32-bit in 64-bit OS
[ ] CFG: if target has CFG, use Interceptor.replace carefully (valid indirect call targets only)
```

### 附加模式
```bash
# A -Spawn (catches TLS, DllMain, global ctors)
frida -l hook.js --no-pause target.exe [-- args]
frida --arch=x86 -l hook.js --no-pause target.exe

# B -Attach by PID / name
frida -p <pid> -l hook.js
frida -n "target.exe" -l hook.js

# C -Gadget (no frida-server; DLL hijack)
# Rename frida-gadget.dll ->version.dll / winmm.dll alongside target.exe
# Connect: frida "gadget" -l hook.js
# Config: frida-gadget-config.json (listen/resume/script mode)

# D -Remote frida-server
frida-server.exe --listen 0.0.0.0:27042   # on target (SYSTEM/admin)
frida -H <ip>:27042 -n "target.exe" -l hook.js
```

### Hook 模式库

#### 模式 1 - 导出符号
```javascript
"use strict";
const fnAddr = Process.getModuleByName("target.exe").getExportByName("TargetFunction");
Interceptor.attach(fnAddr, {
  onEnter(args) {
    console.log("[+] TargetFunction  arg0:", args[0].toInt32(), " arg1:", args[1]);
    if (!args[1].isNull()) console.log(hexdump(args[1], { length: 64, ansi: true }));
  },
  onLeave(retval) { console.log("    retval:", retval.toInt32()); }
});
```

#### 模式 2 - RVA 偏移（无符号）
```javascript
"use strict";
const base   = Process.getModuleByName("target.exe").base;
const fnAddr = base.add(0x12340);  // RVA from IDA
// Calling conventions: cdecl/stdcall args[0]=first; thiscall args[0]=this;
// fastcall x86: ECX/EDX=args[0-1]; x64: RCX/RDX/R8/R9=args[0-3]
// WOW64 guard: always use Process.pointerSize to determine pointer width
Interceptor.attach(fnAddr, {
  onEnter(args) { console.log("[+] sub_12340  this/arg0:", args[0], " arg1:", args[1].toInt32()); },
  onLeave(retval) { console.log("    retval:", retval); }
});
```

#### 模式 3 - IAT Hook
```javascript
"use strict";
const entry = Process.getModuleByName("target.exe").enumerateImports()
              .find(i => i.name === "CryptEncrypt");
if (entry) {
  Interceptor.attach(entry.address, {
    onEnter(args) {
      const len = args[5].isNull() ? 0 : args[5].readU32();
      console.log("[CryptEncrypt] hKey:", args[0], " Final:", args[2].toInt32(), " len:", len);
      if (len > 0 && !args[4].isNull()) console.log(hexdump(args[4], { length: Math.min(len, 256), ansi: true }));
    },
    onLeave(retval) { console.log("    result:", retval.toInt32()); }
  });
} else console.log("[-] Not in IAT -use Pattern 8 (GetProcAddress hook)");
```

#### 模式 4 - 字节特征扫描（ASLR 安全）
```javascript
"use strict";
const mod = Process.getModuleByName("target.exe");
Memory.scanSync(mod.base, mod.size, "55 8B EC 83 EC 18 53 56 57").forEach(m => {
  console.log("[*] Pattern match:", m.address);
  Interceptor.attach(m.address, {
    onEnter(args) { console.log("[+] matched func  arg0:", args[0].toInt32()); },
    onLeave(retval) { console.log("    retval:", retval.toInt32()); }
  });
});
```

#### 模式 5 - 内联补丁 / 强制分支
```javascript
"use strict";
const patchVA = Process.getModuleByName("target.exe").base.add(0x5010);  // RVA from IDA
Memory.protect(patchVA, 16, "rwx");
patchVA.writeByteArray([0xE9, 0x3B, 0x00, 0x00, 0x00, 0x90]);  // jnz ->jmp
// NOP: [0x90,0x90,0x90,0x90,0x90,0x90]  |  short jmp: [0xEB, offset & 0xFF]
// CFG NOTE: patched address must be a valid CFG target if CFG is enabled; check with IDA CFG bitmap
console.log("[+] Patched branch at RVA 0x5010");
```

#### 模式 6 - Interceptor.replace（完整函数替换）
```javascript
"use strict";
const fnAddr = Process.getModuleByName("target.exe").base.add(0x3200);
const origFn = new NativeFunction(fnAddr, "int", ["pointer"]);
Interceptor.replace(fnAddr, new NativeCallback(function(ctxPtr) {
  console.log("[+] IsTrialExpired() ->0");
  return 0;  // Call origFn(ctxPtr) if side-effects needed
}, "int", ["pointer"]));
```

#### 模式 7 - WinAPI Hook（进程内所有调用者）
```javascript
"use strict";
[
  { m: "kernelbase.dll", fn: "IsDebuggerPresent" },
  { m: "advapi32.dll",   fn: "CryptDeriveKey" },
  { m: "bcrypt.dll",     fn: "BCryptEncrypt" },
  { m: "ws2_32.dll",     fn: "connect" },
].forEach(t => {
  const addr = Module.findExportByName(t.m, t.fn);
  if (!addr) { console.log("[-] Not found:", t.fn); return; }
  Interceptor.attach(addr, {
    onEnter(args) { console.log("[" + t.fn + "] called"); },
    onLeave(retval) { console.log("    retval:", retval.toInt32()); }
  });
  console.log("[*] Hooked:", t.fn);
});
```

#### 模式 8 - GetProcAddress Hook（捕获动态解析）
```javascript
"use strict";
const getProcAddr = Module.getExportByName("kernelbase.dll", "GetProcAddress");
const autoHook = new Set(["IsDebuggerPresent","CheckRemoteDebuggerPresent",
  "CryptEncrypt","CryptDecrypt","CryptDeriveKey","BCryptEncrypt","BCryptDecrypt","send","recv","WSAConnect",
  "NtQueryInformationProcess","EtwEventWrite","EtwEventWriteFull"]);
const hooked = new Set();
Interceptor.attach(getProcAddr, {
  onEnter(args) { this.procName = args[1].readAnsiString(); },
  onLeave(retval) {
    if (!this.procName || retval.isNull()) return;
    console.log("[GetProcAddress]", this.procName, "->, retval);
    if (autoHook.has(this.procName) && !hooked.has(retval.toString())) {
      hooked.add(retval.toString());
      const name = this.procName;
      Interceptor.attach(retval, {
        onEnter(args) { console.log("  [dyn:" + name + "] called"); },
        onLeave(rv)   { console.log("  [dyn:" + name + "] retval:", rv.toInt32()); }
      });
      console.log("  ->auto-hooked:", name);
    }
  }
});
```

#### 模式 9 - TLS 回调 Hook（最早执行点）
```javascript
"use strict";
// Must use spawn mode. Get VA from IDA: PE Headers ->Data Directory[TLS] ->AddressOfCallBacks
// Hook LoadLibraryExW to catch DLL load order
Interceptor.attach(Module.getExportByName("kernelbase.dll", "LoadLibraryExW"), {
  onEnter(args) {
    try { console.log("[LoadLibrary]", args[0].readUtf16String()); } catch(e) {}
  }
});
// Hook TLS callbacks directly if VA known from IDA
// const tlsCbVA = Process.getModuleByName("target.exe").base.add(0x<TLS_CB_RVA>);
// Interceptor.attach(tlsCbVA, { onEnter(args){ console.log("[TLS_CB] reason:", args[1].toInt32()); } });
```

#### 模式 10 - VirtualAlloc/VirtualProtect 监控（解壳检测）
```javascript
"use strict";
const PAGE_EXECUTE_READWRITE = 0x40;
["VirtualAlloc","VirtualProtect"].forEach((fn, i) => {
  Interceptor.attach(Module.getExportByName("kernelbase.dll", fn), i === 0 ? {
    onEnter(a) { this._s = a[1].toInt32(); this._p = a[2].toInt32(); },
    onLeave(rv) { if (!rv.isNull() && (this._p & PAGE_EXECUTE_READWRITE)) console.log("[VirtualAlloc] RWX at", rv, "size=0x" + this._s.toString(16)); }
  } : {
    onEnter(a) { if (a[2].toInt32() & PAGE_EXECUTE_READWRITE) console.log("[VirtualProtect] ->RWX at", a[0], "size=0x" + a[1].toInt32().toString(16)); }
  });
});
```

#### 模式 11 - LoadLibraryExW 扩展监控
```javascript
"use strict";
Interceptor.attach(Module.getExportByName("kernelbase.dll", "LoadLibraryExW"), {
  onEnter(args) {
    try { this._lib = args[0].readUtf16String(); } catch(e) { this._lib = "?"; }
  },
  onLeave(retval) {
    console.log("[LoadLibraryExW]", this._lib, "->handle:", retval);
  }
});
```

#### 模式 12 - Stalker（执行跟踪）
```javascript
"use strict";
// Trace all BBs executed by main thread for 2 seconds
const tid = Process.enumerateThreads()[0].id;
Stalker.follow(tid, {
  events: { call: true, ret: false, exec: false, block: true },
  onReceive(events) {
    const parsed = Stalker.parse(events);
    parsed.forEach(e => {
      if (e[0] === 'call') console.log("[call]", e[1], "->, e[2]);
    });
  }
});
setTimeout(() => Stalker.unfollow(tid), 2000);
```

#### 模式 12b - Stalker RDTSC/时钟中和（反时间检测）
```javascript
"use strict";
// Two approaches for RDTSC neutralization:
// Approach A (static patch, preferred for known locations): NOP + fixed return via Pattern 5
// Approach B (Stalker callout -logs RDTSC calls, does NOT replace return value at instruction level)
// NOTE: Stalker transform cannot rewrite x64 register outputs mid-instruction reliably.
// Recommended: locate RDTSC + comparison branch in IDA ->apply Pattern 5 inline patch to force branch.
//
// If you need runtime interception, use a callout to log occurrences:
const tid = Process.enumerateThreads()[0].id;
Stalker.follow(tid, {
  events: { call: false, ret: false, exec: false, block: true },
  transform(iterator) {
    let instr;
    while ((instr = iterator.next()) !== null) {
      if (instr.mnemonic === "rdtsc") {
        // Log RDTSC address; then apply Pattern 5 static patch at this address to NOP it out
        iterator.putCallout(function(ctx) {
          console.log("[RDTSC] at", ctx.pc, "->patch this address with Pattern 5 (NOP + fixed delta)");
        });
      }
      iterator.keep();
    }
  }
});
setTimeout(() => Stalker.unfollow(tid), 3000);
// After identifying RDTSC addresses, apply: Memory.protect(addr,8,"rwx"); addr.writeByteArray([0x48,0x31,0xC0,0x48,0x31,0xD2,0x90,0x90]);
// = xor rax,rax; xor rdx,rdx; nop; nop  ->forces both halves of timestamp to 0
```

#### 模式 13 - VMP dispatcher Stalker 跟踪
```javascript
"use strict";
const base = Process.getModuleByName("target.exe").base;
const vmDispAddr = base.add(0x85000);  // replace with actual dispatcher RVA
const seenEntries = new Map();
Interceptor.attach(vmDispAddr, {
  onEnter(args) {
    let vmKey;
    try { vmKey = Process.arch === "x64" ? this.context.rcx.toInt32() : this.context.esp.add(4).readU32(); } catch(e) { vmKey = 0; }
    if (!seenEntries.has(vmKey)) {
      seenEntries.set(vmKey, this.returnAddress);
      console.log("[VMP] new entry key=0x" + vmKey.toString(16) + " caller=" + this.returnAddress + " (total:" + seenEntries.size + ")");
    }
  }
});
```

#### 模式 14 - WndProc 消息跟踪（自绘 UI）
```javascript
"use strict";
// Locate WndProc RVA in IDA via RegisterClassEx xref or SetWindowLongPtrW xref
const base = Process.getModuleByName("target.exe").base;
const wndProcAddr = base.add(0x12ABC0);  // replace with IDA-located WndProc RVA
const WM = {
  0x0000:"WM_NULL", 0x0001:"WM_CREATE", 0x0002:"WM_DESTROY", 0x000F:"WM_PAINT",
  0x0010:"WM_CLOSE", 0x0100:"WM_KEYDOWN", 0x0101:"WM_KEYUP", 0x0102:"WM_CHAR",
  0x0111:"WM_COMMAND", 0x0112:"WM_SYSCOMMAND", 0x0201:"WM_LBUTTONDOWN",
  0x0202:"WM_LBUTTONUP", 0x004E:"WM_NOTIFY", 0x0084:"WM_NCHITTEST",
  0x0020:"WM_SETCURSOR", 0x0200:"WM_MOUSEMOVE", 0x020A:"WM_MOUSEWHEEL",
};
Interceptor.attach(wndProcAddr, {
  onEnter(args) {
    const uMsg = args[1].toInt32();
    const msgName = WM[uMsg] || (uMsg >= 0x8000 ? "WM_APP+" + (uMsg - 0x8000) : uMsg >= 0x0400 ? "WM_USER+" + (uMsg - 0x0400) : "0x" + uMsg.toString(16));
    if (uMsg === 0x000F || uMsg === 0x0200 || uMsg === 0x0020) return;  // skip WM_PAINT/MOUSEMOVE/SETCURSOR flood
    console.log("[WndProc] msg=" + msgName + " wP=0x" + args[2].toInt32().toString(16) + " lP=0x" + args[3].toInt32().toString(16));
    if (uMsg === 0x0111)
      console.log("  ctrlId=" + (args[2].toInt32() & 0xFFFF) + " notifCode=" + ((args[2].toInt32() >> 16) & 0xFFFF));
    if (uMsg >= 0x0400 && uMsg < 0x8000)
      console.log("  [CUSTOM MSG] -check IDA for dispatch switch in WndProc");
  }
});
```

#### 模式 14b - SetWindowLongPtrW Hook（动态子类化）
```javascript
"use strict";
const hookedProcs = new Set();
Interceptor.attach(Module.getExportByName("user32.dll", "SetWindowLongPtrW"), {
  onEnter(args) {
    if (args[1].toInt32() !== -4) return;  // GWLP_WNDPROC = -4
    const newProc = args[2];
    console.log("[SetWindowLongPtrW] hwnd=" + args[0] + " new WndProc=" + newProc);
    if (!hookedProcs.has(newProc.toString())) {
      hookedProcs.add(newProc.toString());
      try {
        Interceptor.attach(newProc, {
          onEnter(a) {
            const uMsg = a[1].toInt32();
            if (uMsg >= 0x0400) console.log("  [SubclassProc] msg=0x" + uMsg.toString(16) + " wP=0x" + a[2].toInt32().toString(16));
          }
        });
      } catch(e) { console.log("  hook failed:", e.message); }
    }
  }
});
```

#### 模式 14c - PostMessage/SendMessage 监控
```javascript
"use strict";
["PostMessageW","SendMessageW","PostThreadMessageW"].forEach(fn => {
  const addr = Module.findExportByName("user32.dll", fn);
  if (!addr) return;
  Interceptor.attach(addr, {
    onEnter(args) {
      const uMsg = args[1].toInt32();
      if (uMsg >= 0x0400) {
        const range = uMsg >= 0x8000 ? "WM_APP+" + (uMsg - 0x8000) : "WM_USER+" + (uMsg - 0x0400);
        console.log("[" + fn + "] " + range + " wP=0x" + args[2].toInt32().toString(16) + " lP=0x" + args[3].toInt32().toString(16));
      }
    }
  });
});
```

#### 模式 15 - EAT Hook
```javascript
"use strict";
const target = Process.getModuleByName("target.dll").enumerateExports().find(e => e.name === "TargetExport");
if (!target) { console.log("[-] Export not found"); }
else {
  Interceptor.attach(target.address, {
    onEnter(args)   { console.log("[EAT] TargetExport  arg0:", args[0].toInt32()); },
    onLeave(retval) { console.log("  retval:", retval.toInt32()); }
  });
}
```

#### 模式 16 - COM vtable Hook
```javascript
"use strict";
function hookCOMSlot(instancePtr, slotIndex, argTypes, retType, label) {
  const vtable  = instancePtr.readPointer();
  const slotPtr = vtable.add(slotIndex * Process.pointerSize);
  const fnAddr  = slotPtr.readPointer();
  const origFn  = new NativeFunction(fnAddr, retType, ["pointer"].concat(argTypes));
  Memory.protect(slotPtr, Process.pointerSize, "rwx");
  slotPtr.writePointer(new NativeCallback(function(thisPtr, ...rest) {
    console.log("[" + label + "] this=" + thisPtr);
    rest.forEach((a, i) => console.log("  arg" + i + ":", a));
    const rv = origFn(thisPtr, ...rest);
    console.log("  retval:", rv);
    return rv;
  }, retType, ["pointer"].concat(argTypes)));
  console.log("[*] COM slot", slotIndex, "hooked:", label);
}
// hookCOMSlot(ptr("0x12345678"), 3, ["pointer","uint32"], "int", "ITarget::DoWork");
```

#### 模式 17 - .NET CLR 方法 Hook
```javascript
"use strict";
// dnSpy: Go to Disassembly. WinDbg SOS: !ip2md <addr> ->!dumpmd ->NativeCode
const nativeCodeAddr = ptr("0x7FFC12340000");  // from !dumpmd NativeCode
Interceptor.attach(nativeCodeAddr, {
  onEnter(args) {
    console.log("[CLR] called  this=" + args[0]);
    try {
      const len = args[1].add(4).readU32();
      console.log("  arg1 (string):", args[1].add(8).readUtf16String(len * 2));
    } catch(e) {}
  },
  onLeave(retval) { console.log("  retval:", retval); }
});
```

#### 模式 18 - NtCreateThreadEx / CreateRemoteThread 注入监控
```javascript
"use strict";
// Detects code injection attempts into this process; useful for EDR evasion analysis
const ntdll = Process.getModuleByName("ntdll.dll");
const NtCTE = ntdll.findExportByName("NtCreateThreadEx");
if (NtCTE) {
  Interceptor.attach(NtCTE, {
    onEnter(args) {
      // args[3] = StartRoutine (start address in target process)
      console.log("[NtCreateThreadEx] startRoutine:", args[3], "arg:", args[4]);
      try { console.log("  module:", Process.findModuleByAddress(args[3]) ? Process.findModuleByAddress(args[3]).name : "UNKNOWN (shellcode?)"); } catch(e) {}
    }
  });
}
// Also hook QueueUserAPC for APC injection
const QUAPC = Module.findExportByName("kernelbase.dll", "QueueUserAPC");
if (QUAPC) Interceptor.attach(QUAPC, {
  onEnter(args) { console.log("[QueueUserAPC] pfnAPC:", args[0], "hThread:", args[1]); }
});
```

#### 模式 19 - ETW Provider Hook（检测 ETW 监控）
```javascript
"use strict";
// Hook EtwEventWrite to suppress telemetry from reaching ETW consumers (e.g., EDR)
// WARNING: use only in authorized analysis VMs; this blinds system telemetry
const ntdll = Process.getModuleByName("ntdll.dll");
["EtwEventWrite","EtwEventWriteFull","EtwEventWriteEx"].forEach(fn => {
  const addr = ntdll.findExportByName(fn);
  if (!addr) return;
  Interceptor.replace(addr, new NativeCallback(() => 0, "uint32", ["pointer","pointer","uint64","uint64","pointer","pointer","uint32","pointer"]));
  console.log("[*] ETW suppressed:", fn);
});
```

#### 模式 20 - ntdll unhook（检测并恢复 EDR 内联 Hook）
```javascript
"use strict";
// EDR products hook ntdll syscall stubs with JMP redirects.
// This pattern detects and restores original syscall stubs from a clean ntdll copy.
// Requires: a clean copy of ntdll.dll mapped from disk (not the hooked in-memory version)
(function unhookNtdll() {
  const ntdllMem = Process.getModuleByName("ntdll.dll");
  // Map clean ntdll from disk
  const cleanHandle = new NativeFunction(
    Module.getExportByName("kernelbase.dll", "CreateFileMappingW"), "pointer",
    ["pointer","pointer","uint32","uint32","uint32","pointer"]
  );
  // Simplified: enumerate exports and check for JMP/INT3 (0xE9/0xCC) as first byte
  ntdllMem.enumerateExports().filter(e => e.type === "function").forEach(exp => {
    try {
      const firstByte = exp.address.readU8();
      if (firstByte === 0xE9 || firstByte === 0xCC) {
        console.log("[HOOKED EXPORT]", exp.name, "at", exp.address, "firstByte=0x" + firstByte.toString(16));
      }
    } catch(e) {}
  });
  console.log("[*] ntdll hook scan complete -restore from clean copy if needed");
})();
```

---

### PE 反调试完整绕过脚本

在每个 PE Frida 脚本顶部（spawn 模式）使用。必须在 Anti-Frida Bypass Block 之后应用。

```javascript
"use strict";
(function peAntiDebugBypass() {
  const kb    = "kernelbase.dll";
  const ntdll = Process.getModuleByName("ntdll.dll");
  const arch  = Process.arch;

  // 1. IsDebuggerPresent
  Interceptor.replace(Module.getExportByName(kb, "IsDebuggerPresent"),
    new NativeCallback(() => 0, "int", []));

  // 2. CheckRemoteDebuggerPresent
  Interceptor.attach(Module.getExportByName(kb, "CheckRemoteDebuggerPresent"), {
    onEnter(a) { this._pb = a[1]; },
    onLeave(rv) { if (this._pb && !this._pb.isNull()) Memory.writeU32(this._pb, 0); rv.replace(1); }
  });

  // 3. NtQueryInformationProcess (ProcessDebugPort=7, DebugObjectHandle=0x1E, DebugFlags=0x1F)
  Interceptor.attach(ntdll.getExportByName("NtQueryInformationProcess"), {
    onEnter(a) { this.cls = a[1].toInt32(); this.out = a[2]; },
    onLeave()  { if ([7,0x1E,0x1F].includes(this.cls) && this.out && !this.out.isNull()) Memory.writeU64(this.out, uint64(0)); }
  });

  // 4. NtSetInformationThread (ThreadHideFromDebugger=0x11)
  const origNtSIT = new NativeFunction(ntdll.getExportByName("NtSetInformationThread"), "int", ["pointer","uint32","pointer","uint32"]);
  Interceptor.replace(ntdll.getExportByName("NtSetInformationThread"),
    new NativeCallback((h,cls,info,len) => cls === 0x11 ? 0 : origNtSIT(h,cls,info,len), "int", ["pointer","uint32","pointer","uint32"]));

  // 5. OutputDebugString (timing trick)
  ["OutputDebugStringA","OutputDebugStringW"].forEach(fn => {
    const addr = Module.findExportByName(kb, fn);
    const isW  = fn.endsWith("W");
    if (addr) Interceptor.replace(addr, new NativeCallback(s => {
      try { console.log("[bypass]", fn, isW ? s.readUtf16String() : s.readAnsiString()); } catch(e) {}
    }, "void", ["pointer"]));
  });

  // 6. FindWindowW (debugger window scan)
  const FWW = Module.findExportByName("user32.dll", "FindWindowW");
  if (FWW) {
    const origFWW = new NativeFunction(FWW, "pointer", ["pointer","pointer"]);
    const blocklist = ["x32dbg","x64dbg","OllyDbg","IDA","Ghidra","Wireshark","Process Hacker","Cheat Engine","Immunity Debugger"];
    Interceptor.replace(FWW, new NativeCallback((cls,title) => {
      try { if (title && !title.isNull() && blocklist.some(d => title.readUtf16String().includes(d))) return ptr(0); } catch(e) {}
      return origFWW(cls, title);
    }, "pointer", ["pointer","pointer"]));
  }

  // 7. PEB.NtGlobalFlag + Heap flags (WOW64-safe)
  // PEB obtained via NtQueryInformationProcess(ProcessBasicInformation) — works on x86/x64/ARM64
  try {
    const ptrSz = Process.pointerSize;
    const NtQIP = new NativeFunction(
      Module.getExportByName("ntdll.dll", "NtQueryInformationProcess"),
      "int", ["pointer", "uint32", "pointer", "uint32", "pointer"]
    );
    // PROCESS_BASIC_INFORMATION: Reserved1(+0), PebBaseAddress(+ptrSz), ...
    const pbi = Memory.alloc(ptrSz * 6);
    NtQIP(ptr(-1), 0 /* ProcessBasicInformation */, pbi, pbi.size(), ptr(0));
    const peb = pbi.add(ptrSz).readPointer();
    // NtGlobalFlag offset: 0xBC (x64), 0x68 (x86)
    const ntgfOff = arch === "x64" ? 0xBC : 0x68;
    const flagVal = Memory.readU32(peb.add(ntgfOff));
    if (flagVal & 0x70) Memory.writeU32(peb.add(ntgfOff), flagVal & ~0x70);
    // Heap flags: ProcessHeap offset 0x30 (x64), 0x18 (x86); Flags at +0x70/+0x14; ForceFlags at +0x74/+0x18
    const heapPtrOff = arch === "x64" ? 0x30 : 0x18;
    const heap = ptr(arch === "x64"
      ? Memory.readU64(peb.add(heapPtrOff))
      : Memory.readU32(peb.add(heapPtrOff)));
    Memory.writeU32(heap.add(arch === "x64" ? 0x70 : 0x14), 0x02);  // Flags = HEAP_GROWABLE only
    Memory.writeU32(heap.add(arch === "x64" ? 0x74 : 0x18), 0x00);  // ForceFlags = 0
  } catch(e) { console.log("[bypass] PEB patch skipped:", e.message); }

  // 8. WinVerifyTrust
  const WVT = Module.findExportByName("wintrust.dll", "WinVerifyTrust");
  if (WVT) Interceptor.replace(WVT, new NativeCallback(() => 0, "long", ["pointer","pointer","pointer"]));

  // 9. NtQuerySystemInformation (SystemKernelDebuggerInformation=0x23)
  Interceptor.attach(ntdll.getExportByName("NtQuerySystemInformation"), {
    onEnter(a) { this.cls = a[0].toInt32(); this.out = a[1]; },
    onLeave()  { if (this.cls === 0x23 && this.out && !this.out.isNull()) { this.out.writeU8(0); this.out.add(1).writeU8(1); } }
  });

  // 10. SetUnhandledExceptionFilter (SEH-based anti-debug)
  const SUEF = Module.findExportByName(kb, "SetUnhandledExceptionFilter");
  if (SUEF) Interceptor.replace(SUEF, new NativeCallback(() => ptr(0), "pointer", ["pointer"]));

  // 11. CloseHandle (invalid handle trick -debugger raises STATUS_INVALID_HANDLE exception)
  // Anti-debug: pass an invalid handle (e.g. 0xDEADBEEF) to CloseHandle; under a debugger
  // this raises a first-chance exception. We suppress it by catching the NTSTATUS error.
  const CH = Module.findExportByName(kb, "CloseHandle");
  if (CH) {
    const origCH = new NativeFunction(CH, "int", ["pointer"]);
    Interceptor.replace(CH, new NativeCallback(h => {
      try { return origCH(h); } catch(e) { return 0; }  // swallow invalid-handle exceptions
    }, "int", ["pointer"]));
  }

  // 12. NtClose (same invalid handle trick at syscall level)
  const NtClose = ntdll.findExportByName("NtClose");
  if (NtClose) {
    const origNtClose = new NativeFunction(NtClose, "int", ["pointer"]);
    Interceptor.replace(NtClose, new NativeCallback(h => {
      try { return origNtClose(h); } catch(e) { return 0; }
    }, "int", ["pointer"]));
  }

  console.log("[*] PE anti-debug bypass armed  arch=" + arch);
})();
```

---

### Anti-Frida 检测绕过块

**必须在所有其他 Hook 之前运行。** 覆盖：命名管道扫描、模块列表、内存扫描、线程名、27042 端口、EnumProcessModules。

```javascript
"use strict";
(function antiFridaBypass() {
  // 1. Named pipe scan (frida-*, gum-js-loop*)
  const CFW = Module.findExportByName("kernelbase.dll", "CreateFileW");
  if (CFW) {
    const origCFW = new NativeFunction(CFW, "pointer", ["pointer","uint32","uint32","pointer","uint32","uint32","pointer"]);
    Interceptor.replace(CFW, new NativeCallback((name,access,share,sa,cdisp,flags,templ) => {
      try { const n = name.readUtf16String().toLowerCase(); if (n.includes("frida")||n.includes("gum-js")||n.includes("linjector")) return ptr(-1); } catch(e) {}
      return origCFW(name,access,share,sa,cdisp,flags,templ);
    }, "pointer", ["pointer","uint32","uint32","pointer","uint32","uint32","pointer"]));
  }

  // 2. GetModuleHandleW (hide frida-agent)
  const GMH = Module.findExportByName("kernelbase.dll", "GetModuleHandleW");
  if (GMH) {
    const origGMH = new NativeFunction(GMH, "pointer", ["pointer"]);
    Interceptor.replace(GMH, new NativeCallback(name => {
      try { if (!name.isNull()) { const n = name.readUtf16String().toLowerCase(); if (n.includes("frida")||n.includes("linjector")) return ptr(0); } } catch(e) {}
      return origGMH(name);
    }, "pointer", ["pointer"]));
  }

  // 3. ReadProcessMemory (block self-scan for frida-agent bytes)
  const RPM = Module.findExportByName("kernelbase.dll", "ReadProcessMemory");
  if (RPM) {
    const origRPM = new NativeFunction(RPM, "int", ["pointer","pointer","pointer","uint32","pointer"]);
    Interceptor.replace(RPM, new NativeCallback((hProc,base,buf,size,nRead) => {
      try {
        const mod = Process.findModuleByAddress(base);
        if (mod && (mod.name.toLowerCase().includes("frida")||mod.name.toLowerCase().includes("linjector"))) {
          if (nRead && !ptr(nRead).isNull()) Memory.writeU32(ptr(nRead), 0);
          return 0;
        }
      } catch(e) {}
      return origRPM(hProc,base,buf,size,nRead);
    }, "int", ["pointer","pointer","pointer","uint32","pointer"]));
  }

  // 4. Port 27042 probe (frida-server detection)
  const connFn = Module.findExportByName("ws2_32.dll", "connect");
  if (connFn) {
    const origConn = new NativeFunction(connFn, "int", ["int","pointer","int"]);
    Interceptor.replace(connFn, new NativeCallback((sock,addr,len) => {
      try { if (addr.readU16()===2 && (((addr.add(2).readU8()<<8)|addr.add(3).readU8())===27042)) return -1; } catch(e) {}
      return origConn(sock,addr,len);
    }, "int", ["int","pointer","int"]));
  }

  // 5. GetThreadDescription (hide gum-js-loop / frida thread names)
  const GTD = Module.findExportByName("kernelbase.dll", "GetThreadDescription");
  if (GTD) {
    const origGTD = new NativeFunction(GTD, "int", ["pointer","pointer"]);
    Interceptor.replace(GTD, new NativeCallback((hThread,ppDesc) => {
      const hr = origGTD(hThread,ppDesc);
      try { const d = ppDesc.readPointer(); const n = d.readUtf16String().toLowerCase(); if (n.startsWith("frida")||n.startsWith("gum-js")) d.writeU16(0); } catch(e) {}
      return hr;
    }, "int", ["pointer","pointer"]));
  }

  // 6. EnumProcessModules / K32EnumProcessModules (module enumeration hiding)
  ["EnumProcessModules","K32EnumProcessModules"].forEach(fn => {
    const addr = Module.findExportByName("psapi.dll", fn) || Module.findExportByName("kernelbase.dll", fn);
    if (!addr) return;
    const origFn = new NativeFunction(addr, "int", ["pointer","pointer","uint32","pointer"]);
    Interceptor.replace(addr, new NativeCallback((hProc,lphMod,cb,lpcbNeeded) => {
      const ret = origFn(hProc,lphMod,cb,lpcbNeeded);
      if (ret && !lphMod.isNull() && !lpcbNeeded.isNull()) {
        const count = lpcbNeeded.readU32() / Process.pointerSize;
        let writeIdx = 0;
        for (let i = 0; i < count; i++) {
          const hMod = lphMod.add(i * Process.pointerSize).readPointer();
          try {
            const mod = Process.findModuleByAddress(hMod);
            if (mod && (mod.name.toLowerCase().includes("frida") || mod.name.toLowerCase().includes("linjector"))) continue;
          } catch(e) {}
          lphMod.add(writeIdx * Process.pointerSize).writePointer(hMod);
          writeIdx++;
        }
        lpcbNeeded.writeU32(writeIdx * Process.pointerSize);
      }
      return ret;
    }, "int", ["pointer","pointer","uint32","pointer"]));
  });

  console.log("[*] Anti-Frida bypass armed");
})();
```

---

### ETW / EDR 遥测绕过块

**仅在授权分析 VM 中使用。** 当 EDR 通过 ETW 或内核回调检测分析活动时应用。

```javascript
"use strict";
(function etwEdrBypass() {
  const ntdll = Process.getModuleByName("ntdll.dll");

  // 1. Suppress ETW event writes (used by Defender, CrowdStrike, etc. for telemetry)
  ["EtwEventWrite","EtwEventWriteFull","EtwEventWriteEx","EtwEventWriteTransfer"].forEach(fn => {
    const addr = ntdll.findExportByName(fn);
    if (!addr) return;
    // Replace with: xor eax,eax; ret  (0x33 0xC0 0xC3 for x86; same bytes work for x64 stub)
    Memory.protect(addr, 16, "rwx");
    addr.writeByteArray([0x33, 0xC0, 0xC3]);
    console.log("[*] ETW patched:", fn);
  });

  // 2. AmsiScanBuffer patch (AMSI bypass -disable script scanning)
  const amsi = Process.findModuleByName("amsi.dll");
  if (amsi) {
    const scanBuf = amsi.findExportByName("AmsiScanBuffer");
    if (scanBuf) {
      Memory.protect(scanBuf, 16, "rwx");
      // mov eax, 0x80070057 (E_INVALIDARG); ret -bypasses AMSI check
      scanBuf.writeByteArray([0xB8, 0x57, 0x00, 0x07, 0x80, 0xC3]);
      console.log("[*] AMSI patched: AmsiScanBuffer");
    }
  }

  // 3. Detect and log EDR DLL injections (common EDR DLL names in process)
  const edrDlls = ["csfalconservice","mfefirek","cylancememdef","sentinelone","cb.agent",
                   "bdredline","acrord32info","aswhook","avkwl","ctiuser","epag","epclient"];
  Process.enumerateModules().forEach(mod => {
    if (edrDlls.some(e => mod.name.toLowerCase().includes(e))) {
      console.log("[!] EDR DLL detected:", mod.name, "at", mod.base);
    }
  });

  console.log("[*] ETW/EDR bypass armed");
})();
```

---

### PE 加密参数捕获

```javascript
"use strict";
function dumpBuf(label, p, len) {
  if (!p || p.isNull() || len <= 0) return;
  console.log("  [" + label + "] len=" + len);
  console.log(hexdump(p, { length: Math.min(len, 256), ansi: true }));
}

// CryptoAPI (advapi32)
(function hookCryptoAPI() {
  const ALG = { 0x6601:"DES",0x6609:"RC4",0x660E:"AES-128",0x660F:"AES-192",0x6610:"AES-256",0x8001:"RSA-KEYX",0x8003:"MD5",0x8004:"SHA1",0x800C:"SHA256",0x800D:"SHA384",0x800E:"SHA512" };
  [
    { m:"advapi32.dll", fn:"CryptDeriveKey",   onE(a){ console.log("[CryptDeriveKey] alg=0x"+a[1].toInt32().toString(16)+" ("+(ALG[a[1].toInt32()]||"?")+") flags=0x"+a[3].toInt32().toString(16)); } },
    { m:"advapi32.dll", fn:"CryptImportKey",   onE(a){ dumpBuf("CryptImportKey blob",a[1],a[2].toInt32()); } },
    { m:"advapi32.dll", fn:"CryptEncrypt",     onE(a){ this._pb=a[4];this._pl=a[5];dumpBuf("plaintext",a[4],a[5].isNull()?0:a[5].readU32()); } },
    { m:"advapi32.dll", fn:"CryptDecrypt",     onE(a){ this._pb=a[4];this._pl=a[5]; }, onL(rv){ if(rv.toInt32()&&this._pl&&!this._pl.isNull()) dumpBuf("plaintext",this._pb,this._pl.readU32()); } },
    { m:"advapi32.dll", fn:"CryptHashData",    onE(a){ dumpBuf("CryptHashData",a[1],a[2].toInt32()); } },
    { m:"advapi32.dll", fn:"CryptGetHashParam",onE(a){ this._p=a[1].toInt32();this._pb=a[2];this._pl=a[3]; }, onL(rv){ if(this._p===2&&rv.toInt32()&&this._pb&&!this._pb.isNull()) dumpBuf("hash",this._pb,this._pl.readU32()); } },
    { m:"advapi32.dll", fn:"CryptGenKey",      onE(a){ console.log("[CryptGenKey] prov:",a[0],"alg=0x"+a[1].toInt32().toString(16)+" ("+(ALG[a[1].toInt32()]||"?")+") flags=0x"+a[2].toInt32().toString(16)); } },
  ].forEach(h => {
    const addr = Module.findExportByName(h.m, h.fn); if (!addr) return;
    Interceptor.attach(addr, { onEnter(args){if(h.onE)h.onE.call(this,args);}, onLeave(rv){if(h.onL)h.onL.call(this,rv);} });
    console.log("[*] Hooked:", h.fn);
  });
})();

// BCrypt (bcrypt.dll)
(function hookBCrypt() {
  const BCE = Module.findExportByName("bcrypt.dll","BCryptEncrypt");
  if (BCE) Interceptor.attach(BCE, {
    onEnter(a){ dumpBuf("IV",a[4],a[5].toInt32()); dumpBuf("plaintext",a[1],a[2].toInt32()); this._o=a[6];this._s=a[7].toInt32(); },
    onLeave(rv){ if(rv.toInt32()===0) dumpBuf("ciphertext",this._o,this._s); }
  });
  const BCD = Module.findExportByName("bcrypt.dll","BCryptDecrypt");
  if (BCD) Interceptor.attach(BCD, {
    onEnter(a){ this._o=a[6];this._s=a[7].toInt32(); dumpBuf("ciphertext",a[1],a[2].toInt32()); },
    onLeave(rv){ if(rv.toInt32()===0) dumpBuf("plaintext",this._o,this._s); }
  });
  const BGSK = Module.findExportByName("bcrypt.dll","BCryptGenerateSymmetricKey");
  if (BGSK) Interceptor.attach(BGSK, { onEnter(a){ dumpBuf("key material",a[4],a[5].toInt32()); } });
  // BCryptSetProperty (captures algorithm/mode/IV configuration)
  const BSP = Module.findExportByName("bcrypt.dll","BCryptSetProperty");
  if (BSP) Interceptor.attach(BSP, {
    onEnter(a){
      try {
        const propName = a[1].readUtf16String();
        const propVal = a[2]; const propLen = a[3].toInt32();
        console.log("[BCryptSetProperty] prop=" + propName + " len=" + propLen);
        if (propLen > 0 && propLen <= 64) console.log(hexdump(propVal, { length: propLen, ansi: true }));
      } catch(e) {}
    }
  });
})();

// OpenSSL (if linked as DLL)
(function hookOpenSSL() {
  ["libssl-1_1.dll","libssl-1_1-x64.dll","libcrypto-1_1.dll","libssl-3.dll","libcrypto-3.dll",
   "libssl.dll","libcrypto.dll"].forEach(name => {
    const mod = Process.findModuleByName(name); if (!mod) return;
    const EU = mod.findExportByName("EVP_EncryptUpdate");
    if (EU) Interceptor.attach(EU, { onEnter(a){ const l=a[4].toInt32(); if(l>0&&!a[3].isNull()) console.log(hexdump(a[3],{length:Math.min(l,256),ansi:true})); } });
    ["SSL_write","SSL_read"].forEach(fn => {
      const addr = mod.findExportByName(fn); if (!addr) return;
      const isW = fn==="SSL_write";
      Interceptor.attach(addr, {
        onEnter(a){ if(isW){const l=a[2].toInt32();if(l>0)console.log(hexdump(a[1],{length:Math.min(l,512),ansi:true}));}else{this._b=a[1];} },
        onLeave(rv){ if(!isW){const l=rv.toInt32();if(l>0)console.log(hexdump(this._b,{length:Math.min(l,512),ansi:true}));} }
      });
    });
    // Certificate pinning bypass
    const SSLE = mod.findExportByName("SSL_CTX_set_verify");
    if (SSLE) Interceptor.attach(SSLE, {
      onEnter(a){ a[1] = ptr(0); console.log("[SSL_CTX_set_verify] forced SSL_VERIFY_NONE"); }
    });
  });
})();

// Schannel (secur32.dll) — Windows native TLS plaintext capture
(function hookSchannel() {
  var secur32 = Process.findModuleByName("secur32.dll") || Process.findModuleByName("sspicli.dll");
  if (!secur32) return;
  // SecBuffer: cbBuffer(ULONG +0), BufferType(ULONG +4), pvBuffer(PVOID +8)
  //   sizeof: x64=16 (4+4+8, already 8-byte aligned after two ULONGs), x86=12 (4+4+4)
  // SecBufferDesc: ulVersion(ULONG +0), cBuffers(ULONG +4), pBuffers(ptr +8)
  //   sizeof: x64=16 (4+4+8), x86=12 (4+4+4) — no padding on either arch
  var pSz = Process.pointerSize;
  var isX64 = pSz === 8;
  var secBufStride = isX64 ? 16 : 12;
  var descCountOff = 4;                 // cBuffers at +4 in SecBufferDesc (both archs)
  var descBufsOff = 8;                  // pBuffers at +8 in SecBufferDesc (both archs)
  function dumpSecBuffers(desc, label) {
    try {
      var count = desc.add(descCountOff).readU32();
      var bufs = desc.add(descBufsOff).readPointer();
      for (var i = 0; i < Math.min(count, 4); i++) {
        var base = bufs.add(i * secBufStride);
        var cbBuffer = base.readU32();
        var bufType = base.add(4).readU32();
        var pvBuf = base.add(8).readPointer();
        if (bufType === 1 && cbBuffer > 0 && !pvBuf.isNull()) { // SECBUFFER_DATA
          console.log("[" + label + "] plaintext len=" + cbBuffer);
          console.log(hexdump(pvBuf, {length: Math.min(cbBuffer, 512), ansi: true}));
        }
      }
    } catch(e) {}
  }
  var DecryptMsg = secur32.findExportByName("DecryptMessage");
  if (DecryptMsg) Interceptor.attach(DecryptMsg, {
    onEnter(a) { this._bufDesc = a[1]; },
    onLeave(rv) { if (rv.toInt32() === 0) dumpSecBuffers(this._bufDesc, "DecryptMessage"); }
  });
  var EncryptMsg = secur32.findExportByName("EncryptMessage");
  if (EncryptMsg) Interceptor.attach(EncryptMsg, {
    onEnter(a) { dumpSecBuffers(a[2], "EncryptMessage"); }  // EncryptMessage(ctx, seqNo, pBufDesc, QOP)
  });
})();
```

### PE 网络 + 注册表 + 文件 I/O 监控

```javascript
"use strict";
// Network (ws2_32) -including WSASend/WSARecv for IOCP patterns
(function(){
  const ws2="ws2_32.dll";
  const cn=Module.findExportByName(ws2,"connect");
  if(cn) Interceptor.attach(cn,{onEnter(a){const sa=a[1];if(sa.readU16()===2){const port=(sa.add(2).readU8()<<8)|sa.add(3).readU8();const ip=[0,1,2,3].map(i=>sa.add(4+i).readU8()).join(".");console.log("[connect]",ip+":"+port);}}});
  ["send","recv"].forEach(fn=>{
    const addr=Module.findExportByName(ws2,fn);if(!addr)return;const isS=fn==="send";
    Interceptor.attach(addr,{
      onEnter(a){if(isS){const l=a[2].toInt32();if(l>0)console.log("[send] len="+l+"\n"+hexdump(a[1],{length:Math.min(l,256),ansi:true}));}else{this._b=a[1];}},
      onLeave(rv){if(!isS){const l=rv.toInt32();if(l>0)console.log("[recv] len="+l+"\n"+hexdump(this._b,{length:Math.min(l,256),ansi:true}));}}
    });
  });
  // WSASend / WSARecv (IOCP-based network, missed by send/recv hooks)
  ["WSASend","WSARecv"].forEach(fn=>{
    const addr=Module.findExportByName(ws2,fn);if(!addr)return;const isS=fn==="WSASend";
    Interceptor.attach(addr,{
      onEnter(a){
        try{
          // WSABUF: { ULONG cbBuffer; CHAR *buf; }
          // x86: sizeof=8, buf at +4  |  x64: sizeof=16, buf at +8 (4 bytes padding before pointer)
          const wsabuf=a[1];const count=a[2].toInt32();
          const pSz=Process.pointerSize;
          const bufOff=pSz===8?8:4;   // pointer alignment offset
          const stride=pSz===8?16:8;  // sizeof(WSABUF)
          for(let i=0;i<Math.min(count,4);i++){
            const len=wsabuf.add(i*stride).readU32();
            const buf=wsabuf.add(i*stride+bufOff).readPointer();
            if(len>0)console.log("["+fn+"] buf["+i+"] len="+len+"\n"+hexdump(buf,{length:Math.min(len,256),ansi:true}));
          }
        }catch(e){}
      }
    });
  });
  // WinHTTP / WinInet (higher-level HTTP)
  ["winhttp.dll","wininet.dll"].forEach(dll=>{
    const mod=Process.findModuleByName(dll);if(!mod)return;
    ["HttpSendRequestW","WinHttpSendRequest"].forEach(fn=>{
      const addr=mod.findExportByName(fn);if(!addr)return;
      Interceptor.attach(addr,{onEnter(a){try{console.log("["+fn+"]",a[0],"headers:",a[2]&&!a[2].isNull()?a[2].readUtf16String():"");}catch(e){}}});
    });
  });
})();

// Registry (advapi32)
["RegOpenKeyExW","RegQueryValueExW","RegSetValueExW","RegDeleteValueW"].forEach(fn=>{
  const addr=Module.findExportByName("advapi32.dll",fn);if(!addr)return;
  Interceptor.attach(addr,{onEnter(a){try{console.log("["+fn+"] key="+(a[1]&&!a[1].isNull()?a[1].readUtf16String():""));}catch(e){}}});
});

// File I/O (kernelbase)
(function(){
  const kb="kernelbase.dll";
  Interceptor.attach(Module.getExportByName(kb,"CreateFileW"),{
    onEnter(a){try{this._p=a[0].readUtf16String();}catch(e){this._p="?";}},
    onLeave(rv){console.log("[CreateFileW]",this._p,"handle:",rv);}
  });
  Interceptor.attach(Module.getExportByName(kb,"WriteFile"),{
    onEnter(a){const l=a[2].toInt32();if(l>0&&l<=4096)console.log("[WriteFile] len="+l+"\n"+hexdump(a[1],{length:Math.min(l,128),ansi:true}));}
  });
  Interceptor.attach(Module.getExportByName(kb,"ReadFile"),{
    onEnter(a){this._b=a[1];this._n=a[3];},
    onLeave(rv){if(rv.toInt32()&&this._n&&!this._n.isNull()){const l=this._n.readU32();if(l>0)console.log("[ReadFile] len="+l+"\n"+hexdump(this._b,{length:Math.min(l,128),ansi:true}));}}
  });
})();
```

---

### PE Frida 故障排查决策树

```
Frida attach/spawn fails?
-> "Access is denied"
->  -> PPL target? ->kernel driver or x64dbg+admin (Frida cannot attach PPL without kernel)
->  -> Different user/elevated? ->run frida as admin/SYSTEM; or frida-server as SYSTEM
->  -> EDR/AV blocking? ->switch to frida-gadget DLL hijack (Mode C); or apply Pattern 20 (ntdll unhook)
-> "Process not found"
->  -> Name typo? ->frida-ps -a
->  -> x86 on x64? ->frida --arch=x86 -p <pid>
-> Script loads but hooks never fire
->  -> Dynamic WinAPI resolution? ->Pattern 8 (GetProcAddress hook)
->  -> Delay-loaded DLL? ->Pattern 11 (LoadLibraryExW monitor)
->  -> Wrong module name? ->Process.enumerateModules().forEach(m=>console.log(m.name))
-> "unable to intercept function at..."
->  -> Function < 5 bytes (thunk)? ->Interceptor.replace instead
->  -> Read-only page? ->Memory.protect(addr, 16, "rwx") first
->  -> JMP thunk? ->follow JMP to real address
-> Target crashes after hook
->  -> Calling convention mismatch? ->verify stdcall/cdecl/fastcall/thiscall in IDA pseudocode
->  -> Stack imbalance? ->NativeCallback arg count must match original exactly
->  -> WOW64 pointer size? ->confirm Process.pointerSize; use readU32 not readU64 on x86
->  -> Null pointer read? ->add null guard before every readXxx()
-> Anti-Frida detection triggers
->  -> Named pipe/event scan? ->Anti-Frida Bypass Block
->  -> Module list anomaly? ->gadget embedded mode or Anti-Frida Bypass Block
->  -> Memory scan for agent bytes? ->Anti-Frida Bypass Block ReadProcessMemory hook
->  -> Port 27042 probe? ->Anti-Frida Bypass Block connect() hook
-> EDR blocking all attach modes
->  -> Try gadget mode (frida-gadget.dll via DLL hijack)
->  -> Apply Pattern 20 (detect hooked ntdll exports)
->  -> Apply ETW/EDR Bypass Block (Pattern 19)
-> RDTSC/timing checks (cannot hook at instruction level without Stalker)
    ->IDA: locate comparison branch after RDTSC pair
    ->Pattern 5: NOP or force "not timed out" branch
    ->Pattern 12b: Stalker RDTSC transform (preferred -no static patch needed)
```

---

## Electron / Node.js 运行时 Hook

Electron 应用的核心逻辑在 JS/V8 层，Frida 的角色是 hook Node.js 原生层（OpenSSL、V8 内部 API）——不是 hook Windows API。

### Electron 进程模型

| 进程 | 包含 | Frida 能力 |
|------|------|-----------|
| Main Process | Node.js + Electron API | 直接 attach，可 hook Node.js 原生模块 |
| Renderer Process | Chromium + Web API | Frida 可以 attach 但 DevTools 更合适 |
| Utility Process | 网络等子系统 | 较少需要 hook |

### 目标定位

```
Electron 应用中的加密操作不经过 Windows CryptoAPI/BCrypt，
而是通过 Node.js 调用内嵌的 OpenSSL。

关键符号（在 Electron 主进程中搜索）:
  RSA_public_decrypt     → RSA 签名验证
  EVP_PKEY_verify        → 通用公钥验证
  EVP_DecryptFinal_ex    → AES 对称解密
  SHA256_Final / SHA512_Final → 哈希计算
  PKCS7_verify           → 证书验证
```

### Hook 模板: 捕获 Node.js crypto 原生调用

```javascript
// Electron RSA 捕获
// 适用于: 许可证验证、签名校验、token 解密

var rsaDecrypt = Module.findExportByName(null, 'RSA_public_decrypt');
if (rsaDecrypt) {
    Interceptor.attach(rsaDecrypt, {
        onEnter: function(args) {
            this.flen = args[1].readU32();
            this.from = args[2];
            this.rsa = args[4];
            console.log('[RSA_public_decrypt] len=' + this.flen);
            console.log('  ciphertext: ' + hexdump(this.from, {length: Math.min(this.flen, 512)}));
            // 提取 RSA modulus (用于后续分析密钥)
            try {
                var rsaPtr = this.rsa;
                // OpenSSL RSA 结构中 n 的偏移因版本而异
                // 可以通过 RSA_bits() 获取密钥长度
                var rsaBits = new NativeFunction(
                    Module.findExportByName(null, 'RSA_bits'), 'int', ['pointer']
                );
                console.log('  RSA key size: ' + rsaBits(rsaPtr) + ' bits');
            } catch(e) {}
        },
        onLeave: function(retval) {
            if (retval.toInt32() > 0) {
                console.log('[RSA_public_decrypt] SUCCESS, plaintext length=' + retval.toInt32());
            }
        }
    });
}

// AES 解密捕获
var evpDecryptFinal = Module.findExportByName(null, 'EVP_DecryptFinal_ex');
if (evpDecryptFinal) {
    Interceptor.attach(evpDecryptFinal, {
        onEnter: function(args) {
            this.out = args[1];
            this.outLen = args[2];
        },
        onLeave: function(retval) {
            if (retval.toInt32() === 1) {
                var len = this.outLen.readU32();
                console.log('[EVP_DecryptFinal_ex] SUCCESS, len=' + len);
                console.log('  plaintext: ' + hexdump(this.out, {length: Math.min(len, 256)}));
            }
        }
    });
}
```

### Hook 模板: V8 BigInt 构造拦截

```javascript
// V8 字节码中的 BigInt 常量在反序列化时由 V8 内部创建，不经过 JS BigInt 构造函数。
// 因此 JS 层面的 BigInt hook 无法捕获 .jsc 中的密钥。
// 替代方案: hook OpenSSL 层的 RSA_public_decrypt（见上方模板），这是 BigInt 模乘运算的底层实现。
// 或通过 Node.js Inspector (--inspect) 在运行时直接探查闭包变量中的 BigInt 值。
```

### Electron 附加注意事项

```
[ ] 确认附加到 Main Process (不是 Renderer)
    用 frida-ps 列出进程，选 Typora.exe (不是 Typora.exe --type=renderer)
[ ] Node.js 原生符号可能被 strip，用 Module.enumerateExports() 搜索
[ ] 如果目标使用了 asar integrity，修改 asar 后需要绕过 fuses 才能启动
[ ] --inspect 端口可能与 Frida 冲突，不要同时使用
[ ] 对于 .jsc 字节码中的加密逻辑，Frida hook OpenSSL 比 hook JS 更可靠
    因为 V8 反序列化常量不经过 JS BigInt 构造函数
```

