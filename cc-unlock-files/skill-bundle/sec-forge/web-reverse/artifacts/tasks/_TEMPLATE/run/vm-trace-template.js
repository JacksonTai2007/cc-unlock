"use strict";

function safeDepth(value) {
  return Array.isArray(value) ? value.length : null;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.slice() : [];
}

function cloneRegs(regs) {
  if (!regs || typeof regs !== "object") return {};
  if (Array.isArray(regs)) {
    return Object.fromEntries(regs.map((value, index) => [String(index), value]));
  }
  return { ...regs };
}

function diffRegisters(before, after) {
  const prev = cloneRegs(before);
  const next = cloneRegs(after);
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const diff = [];

  for (const key of keys) {
    if (!Object.is(prev[key], next[key])) {
      diff.push({
        reg: key,
        before: prev[key],
        after: next[key]
      });
    }
  }

  return diff;
}

function summarizeState(state, options = {}) {
  const {
    pcKey = "pc",
    stackKey = "stack",
    regsKey = "regs"
  } = options;

  const stack = normalizeArray(state?.[stackKey]);
  return {
    pc: state?.[pcKey] ?? null,
    stackDepth: safeDepth(stack),
    stackTail: stack.slice(-4),
    regs: cloneRegs(state?.[regsKey])
  };
}

function createOpcodeBook(seed = {}) {
  const rows = new Map(Object.entries(seed));

  function record(opcode, patch = {}) {
    const key = String(opcode);
    const current = rows.get(key) || {
      opcode: key,
      handler: "",
      operand_width: "",
      stack_delta: "",
      regs_read: [],
      regs_write: [],
      control_flow: "",
      category: "",
      confidence: "",
      notes: ""
    };
    rows.set(key, {
      ...current,
      ...patch
    });
  }

  return {
    record,
    entries() {
      return Array.from(rows.values());
    }
  };
}

function traceBytecodeDecode(target, methodName, options = {}) {
  const {
    logger = console.log,
    label = methodName
  } = options;
  const original = target?.[methodName];
  if (typeof original !== "function") {
    throw new Error(`Decode function not found: ${methodName}`);
  }

  target[methodName] = function (...args) {
    logger("[vm-decode]", JSON.stringify({
      label,
      phase: "before",
      argTypes: args.map((value) => Array.isArray(value) ? "array" : typeof value),
      lengthHint: args[0]?.length ?? null
    }));

    const rv = original.apply(this, args);

    logger("[vm-decode]", JSON.stringify({
      label,
      phase: "after",
      resultType: Array.isArray(rv) ? "array" : typeof rv,
      resultLength: rv?.length ?? null
    }));
    return rv;
  };

  return target;
}

function traceDispatcher(instance, options = {}) {
  const {
    dispatchName = "_dispatch",
    getState = function () { return this; },
    getOpcode = function (opcode) { return opcode; },
    logger = console.log,
    opcodeBook,
    stateOptions = {}
  } = options;

  const original = instance?.[dispatchName];
  if (typeof original !== "function") {
    throw new Error(`Dispatcher function not found: ${dispatchName}`);
  }

  instance[dispatchName] = function (opcode, ...rest) {
    const beforeRaw = getState.call(this);
    const before = summarizeState(beforeRaw, stateOptions);
    const normalizedOpcode = getOpcode.call(this, opcode, ...rest);

    logger("[vm-trace]", JSON.stringify({
      phase: "before",
      opcode: normalizedOpcode,
      pc: before.pc,
      stackDepth: before.stackDepth,
      stackTail: before.stackTail,
      regsTouched: null
    }));

    const rv = original.call(this, opcode, ...rest);

    const afterRaw = getState.call(this);
    const after = summarizeState(afterRaw, stateOptions);
    const regsTouched = diffRegisters(before.regs, after.regs);

    logger("[vm-trace]", JSON.stringify({
      phase: "after",
      opcode: normalizedOpcode,
      pc: after.pc,
      stackDepth: after.stackDepth,
      stackTail: after.stackTail,
      regsTouched
    }));

    if (opcodeBook) {
      opcodeBook.record(normalizedOpcode, {
        regs_write: regsTouched.map((item) => item.reg)
      });
    }

    return rv;
  };

  return instance;
}

function wrapHandlerTable(handlerTable, options = {}) {
  const {
    getState = function () { return this; },
    logger = console.log,
    classifyHandler = function () { return "unknown"; },
    opcodeBook,
    stateOptions = {}
  } = options;

  for (const [opcode, handler] of Object.entries(handlerTable || {})) {
    if (typeof handler !== "function") continue;
    handlerTable[opcode] = function (...args) {
      const beforeRaw = getState.call(this);
      const before = summarizeState(beforeRaw, stateOptions);
      logger("[vm-handler]", JSON.stringify({
        opcode,
        phase: "before",
        pc: before.pc,
        stackDepth: before.stackDepth
      }));

      const rv = handler.apply(this, args);

      const afterRaw = getState.call(this);
      const after = summarizeState(afterRaw, stateOptions);
      const regsDiff = diffRegisters(before.regs, after.regs);
      logger("[vm-handler]", JSON.stringify({
        opcode,
        phase: "after",
        pc: after.pc,
        stackDepth: after.stackDepth,
        regsTouched: regsDiff
      }));

      if (opcodeBook) {
        opcodeBook.record(opcode, {
          category: classifyHandler.call(this, opcode, args, rv, beforeRaw, afterRaw),
          stack_delta:
            before.stackDepth != null && after.stackDepth != null
              ? after.stackDepth - before.stackDepth
              : "",
          regs_read: Object.keys(before.regs),
          regs_write: regsDiff.map((item) => item.reg)
        });
      }

      return rv;
    };
  }
  return handlerTable;
}

function wrapBridgeCalls(target, names, options = {}) {
  const {
    logger = console.log,
    label = "bridge"
  } = options;

  for (const name of names || []) {
    const original = target?.[name];
    if (typeof original !== "function") continue;

    target[name] = function (...args) {
      logger("[vm-bridge]", JSON.stringify({
        label,
        name,
        phase: "before",
        argc: args.length
      }));
      const rv = original.apply(this, args);
      logger("[vm-bridge]", JSON.stringify({
        label,
        name,
        phase: "after",
        resultType: typeof rv
      }));
      return rv;
    };
  }

  return target;
}

module.exports = {
  createOpcodeBook,
  diffRegisters,
  traceBytecodeDecode,
  traceDispatcher,
  wrapBridgeCalls,
  wrapHandlerTable
};
