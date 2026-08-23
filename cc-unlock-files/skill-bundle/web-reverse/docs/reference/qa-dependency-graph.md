<!-- publish: framework -->
# QA 检查依赖图

## 共享库（lib）

```
tools/qa/common.mjs              ← 核心共享工具（failWith, readText, readJson, repoRoot, walk, exists）
    ├── tools/qa/topic-registry.mjs
    │   └── readTopicRegistry(), topicHasMaturity(), listTopicsByMaturity()
    ├── tools/qa/task-snapshot-lib.mjs
    │   └── loadTaskSnapshots(), primeTaskSnapshotCache()
    ├── tools/qa/eval-regression-lib.mjs
    │   └── readMergedEvalSet()
    ├── tools/qa/rollout-targets-lib.mjs
    ├── tools/task/common.mjs
    │   └── resolveTaskDir(), taskFile(), readTaskJson(), buildTaskFromTemplates()
    └── tools/qa/check-manifest.mjs
        └── getChecksForGroup(), checkManifest[], tier metadata
```

## 检查脚本依赖树

```
check-all.mjs
├── check-manifest.mjs (tier grouping)
├── task-snapshot-lib.mjs (cache prime)
└── [spawns all checks based on tier]

分组执行顺序 (cumulative):
  fast (27 checks, ~8s total)
  ├── check-utf8.mjs               → common.mjs
  ├── check-naming.mjs             → (standalone)
  ├── check-template.mjs           → common.mjs, topic-registry.mjs
  ├── check-bridge-docs.mjs        → common.mjs
  ├── check-websearch-contract.mjs → common.mjs
  ├── check-external-research-sync.mjs  → common.mjs
  ├── check-prompt-coverage.mjs    → common.mjs, topic-registry.mjs
  ├── check-topic-manifest-sync.mjs → common.mjs
  ├── check-doc-fact-sync.mjs      → common.mjs
  ├── check-operating-contracts.mjs → common.mjs
  ├── check-task-packs.mjs         → common.mjs, topic-registry.mjs, task/common.mjs
  ├── check-task-semantics.mjs     → common.mjs, topic-registry.mjs, task/common.mjs
  ├── check-task-init-contract.mjs → common.mjs, task/common.mjs
  ├── check-task-start-contract.mjs → common.mjs
  ├── check-delivery-authenticity.mjs → common.mjs, task/common.mjs
  ├── check-progress-chatter.mjs   → common.mjs
  ├── check-rollout-auto-continue.mjs → common.mjs
  ├── check-rollout-governance.mjs → common.mjs
  ├── check-execution-discipline.mjs → common.mjs
  ├── check-hook-discipline.mjs    → common.mjs
  ├── check-eval-regression.mjs    → common.mjs, eval-regression-lib.mjs
  ├── check-reasoning-regression.mjs → common.mjs
  ├── check-capability-coverage.mjs → common.mjs, topic-registry.mjs
  ├── check-specialized-strength.mjs → common.mjs, topic-registry.mjs
  ├── check-maturity-consistency.mjs → common.mjs
  ├── check-skill-contract.mjs     → common.mjs
  └── lint-cases.mjs               → (standalone)

  full (fast + 4, ~500s total)
  ├── check-deliverables.mjs       → common.mjs, task-snapshot-lib.mjs [250s]
  ├── check-route-authority.mjs    → common.mjs [4s]
  ├── check-route-consistency.mjs  → common.mjs, task/common.mjs, task-snapshot-lib.mjs [230s]
  └── check-task-tool-discipline.mjs → common.mjs [5s]

  deep (full + 4, ~1000s total)
  ├── check-external-workspace-lifecycle.mjs → common.mjs [260s]
  ├── check-auto-advance-contract.mjs  → common.mjs [15s]
  ├── check-reply-gate-contract.mjs    → common.mjs [15s]
  ├── check-evidence-closeout.mjs      → common.mjs, task/common.mjs [130s]
  └── check-synthetic-e2e.mjs          → common.mjs, topic-registry.mjs [560s]
```

## 关键依赖路径

| 修改内容 | 影响范围 | 应重跑的检查 |
|----------|---------|-------------|
| `common.mjs` 导出变更 | 30+ 检查脚本 | `check:fast` |
| `topic-registry.mjs` 变更 | 6 检查脚本 + topic sync | `check:topic-manifests`, `check:task-semantics`, `check:capability-coverage` |
| `task/common.mjs` 变更 | 6 检查脚本 | `check:fast` + `check:full` |
| `task-snapshot-lib.mjs` 变更 | 3 检查脚本 | `check:deliverables`, `check:route-consistency` |
| `eval_set.json` 断言变更 | `check-eval-regression` | `check:eval-regression` |
| topic.json synthetic 变更 | `check-synthetic-e2e` | `check:synthetic-e2e` |
| SKILL.md 正文变更 | `check-skill-contract` | `check:skill-contract` |

## 执行建议

- **日常开发后**: `npm run check:fast`（27 checks, ~8s）
- **合并前**: `npm run check:full`（31 checks, ~500s）
- **发布前**: `npm run release:prep`（sync + fast + full）
- **完整验证**: `npm run check:deep`（35 checks, ~1000s）
- **单点验证**: 直接运行对应 check 脚本（如 `node tools/qa/check-eval-regression.mjs`）
