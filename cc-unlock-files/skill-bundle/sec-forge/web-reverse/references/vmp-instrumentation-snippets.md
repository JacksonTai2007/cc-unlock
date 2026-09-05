# VMP Instrumentation Snippets

以下片段用于 task-local 快速落地，建议复制到：

- `run/vm-trace-template.js`
- `env/entry.js`
- 站点专用 trace 脚本

## 1. 捕获 VM constructor

```javascript
function hookVmConstructor(root, ctorName) {
  const Original = root[ctorName];
  root[ctorName] = function (bytecode, ...rest) {
    console.log("[vm-boundary]", JSON.stringify({
      ctorName,
      bytecodeLength: bytecode?.length ?? null
    }));
    return new Original(bytecode, ...rest);
  };
}
```

## 2. 包装 dispatcher

```javascript
const { traceDispatcher } = require("./vm-trace-template.js");
traceDispatcher(vmInstance, {
  dispatchName: "_dispatch",
  getState() {
    return { pc: this.pc, stack: this.stack };
  }
});
```

## 3. 包装 handler table

```javascript
const { wrapHandlerTable } = require("./vm-trace-template.js");
wrapHandlerTable(vmInstance.handlers, function () {
  return { pc: this.pc, stack: this.stack };
});
```

## 4. 记录 bridge call

```javascript
const { wrapBridgeCalls, traceBytecodeDecode, createOpcodeBook } = require("./vm-trace-template.js");
const opcodeBook = createOpcodeBook();
traceBytecodeDecode(vmLoader, "decode");
wrapBridgeCalls(window, ["atob", "btoa"]);
```
