import { failWith, readJson, readMergedEvalSet, readText } from "./common.mjs";

const findings = [];
const artifacts = new Map();

function getText(relPath) {
  if (!artifacts.has(relPath)) {
    try {
      artifacts.set(relPath, readText(relPath));
    } catch {
      artifacts.set(relPath, "");
    }
  }
  return artifacts.get(relPath);
}

function fileHas(relPath, needles) {
  const text = getText(relPath);
  return needles.every((needle) => text.includes(needle));
}

function jsonPathExists(obj, path) {
  let current = obj;
  for (const key of path) {
    if (current == null || !(key in current)) {
      return false;
    }
    current = current[key];
  }
  return true;
}

function levelFor(score) {
  if (score >= 90) return "coverage-strong";
  if (score >= 75) return "coverage-good";
  if (score >= 60) return "coverage-basic";
  return "coverage-weak";
}

function evaluateCapability(capability) {
  let score = 0;
  const missed = [];

  for (const item of capability.items) {
    const passed = item.check();
    if (passed) {
      score += item.weight;
    } else {
      missed.push(item.name);
    }
  }

  const level = levelFor(score);
  console.log(`[${capability.name}] score=${score}/100 level=${level}`);
  if (missed.length > 0) {
    console.log(`  missing: ${missed.join("; ")}`);
  }

  if (level !== "coverage-strong") {
    findings.push(
      `${capability.name} level=${level} score=${score}/100; missing: ${missed.join("; ")}`
    );
  }
}

const vmTaskTemplate = readJson("artifacts/tasks/_TEMPLATE/extensions/vm.json");
const envTaskTemplate = readJson("artifacts/tasks/_TEMPLATE/extensions/env.json");
const evalSet = readMergedEvalSet();

const capabilities = [
  {
    name: "jsvmp",
    items: [
      {
        name: "skill routing escalates to dedicated advanced VMP materials",
        weight: 10,
        check() {
          return fileHas("SKILL.md", [
            "references/vmp-advanced-playbook.md",
            "scripts/cases/web-jsvmp-devirtualization-workflow.mjs"
          ]);
        }
      },
      {
        name: "advanced VMP playbook covers nested VM, decode chain, false positives, and exit gates",
        weight: 15,
        check() {
          return fileHas("references/vmp-advanced-playbook.md", [
            "多层 VM / VM + WASM",
            "bytecode decode 链",
            "误判排查",
            "退出门槛"
          ]);
        }
      },
      {
        name: "VMP workflow defines runtime trace, decode evidence, and handler clustering deliverables",
        weight: 15,
        check() {
          return fileHas("scripts/cases/web-jsvmp-devirtualization-workflow.mjs", [
            "bytecode decode",
            "handler 分类",
            "run/vm-decode-notes.md",
            "run/vm-handler-clusters.md"
          ]);
        }
      },
      {
        name: "VM template tracks decode, bridge, register diff, and opcode book generation",
        weight: 20,
        check() {
          return fileHas("artifacts/tasks/_TEMPLATE/run/vm-trace-template.js", [
            "traceBytecodeDecode",
            "wrapBridgeCalls",
            "diffRegisters",
            "createOpcodeBook"
          ]);
        }
      },
      {
        name: "task template records advanced VM state and coverage fields",
        weight: 15,
        check() {
          return [
            ["vm", "decodeStatus"],
            ["vm", "stateModel"],
            ["vm", "bridgeStatus"],
            ["vm", "exceptionStatus"],
            ["vm", "traceSignals"],
            ["vm", "handlerClusters"]
          ].every((path) => jsonPathExists(vmTaskTemplate, path));
        }
      },
      {
        name: "VM artifact templates capture boundary, decode chain, bridge, clusters, and unknowns",
        weight: 15,
        check() {
          return fileHas("artifacts/tasks/_TEMPLATE/run/dispatcher-map.md", [
            "Bytecode Carrier",
            "Decode Chain",
            "Bridge / Host Calls",
            "Handler Clusters",
            "UNKNOWNS"
          ]) && fileHas("artifacts/tasks/_TEMPLATE/run/vm-opcodes.txt", [
            "stack_delta",
            "regs_read",
            "regs_write",
            "control_flow"
          ]);
        }
      },
      {
        name: "eval set contains hard JSVMP prompts",
        weight: 10,
        check() {
          return evalSet.some((item) => String(item.query).includes("多层 JS-VMP")) &&
            evalSet.some((item) => String(item.query).includes("handler table")) &&
            evalSet.some((item) => String(item.query).includes("VM + WASM"));
        }
      }
    ]
  },
  {
    name: "env-patching",
    items: [
      {
        name: "skill routing escalates to dedicated env drift materials",
        weight: 10,
        check() {
          return fileHas("SKILL.md", [
            "references/env-drift-decision-tree.md",
            "scripts/cases/web-node-env-patching-workflow.mjs"
          ]);
        }
      },
      {
        name: "env decision tree covers drift taxonomy, evidence chain, patch unit, and pure gate",
        weight: 20,
        check() {
          return fileHas("references/env-drift-decision-tree.md", [
            "drift taxonomy",
            "证据链",
            "最小补丁单元",
            "PureExtraction 准入"
          ]);
        }
      },
      {
        name: "env workflow requires browser snapshot to node rebuild loop and residual mismatch reporting",
        weight: 15,
        check() {
          return fileHas("scripts/cases/web-node-env-patching-workflow.mjs", [
            "browser -> node",
            "残留未对齐项",
            "run/env-drift-matrix.md",
            "run/browser-env-snapshot.json"
          ]);
        }
      },
      {
        name: "env template probes descriptor, scheduler, typed array, crypto, storage, and call results",
        weight: 20,
        check() {
          return fileHas("artifacts/tasks/_TEMPLATE/run/env-conformance-template.js", [
            "logCallResult",
            "logTypedArraySurface",
            "logCryptoSurface",
            "logStorageRoundTrip",
            "logMicrotaskOrder"
          ]);
        }
      },
      {
        name: "task template records drift surfaces, evidence source, and patch statuses",
        weight: 15,
        check() {
          return [
            ["envConformance", "evidenceSource"],
            ["envConformance", "minimalPatchUnit"],
            ["envConformance", "descriptorStatus"],
            ["envConformance", "schedulerStatus"],
            ["envConformance", "typedArrayStatus"],
            ["envConformance", "cryptoStatus"],
            ["envConformance", "storageStatus"],
            ["envConformance", "fingerprintStatus"]
          ].every((path) => jsonPathExists(envTaskTemplate, path));
        }
      },
      {
        name: "env artifact templates force drift matrix, rerun shift, blockers, and pure gate",
        weight: 10,
        check() {
          return fileHas("artifacts/tasks/_TEMPLATE/run/env-conformance-notes.md", [
            "Evidence chain",
            "Rerun shift",
            "PureExtraction gate",
            "Blocked by"
          ]);
        }
      },
      {
        name: "eval set contains hard env patching prompts",
        weight: 10,
        check() {
          return evalSet.some((item) => String(item.query).includes("descriptor")) &&
            evalSet.some((item) => String(item.query).includes("queueMicrotask")) &&
            evalSet.some((item) => String(item.query).includes("补环境"));
        }
      }
    ]
  }
];

for (const capability of capabilities) {
  evaluateCapability(capability);
}

failWith(findings, "check-jsvmp-env-strength");
