<!-- generated: route-plan; source=state/route-state.json; do-not-edit-directly -->

# Route Plan

Generated At: 2026-03-25T13:26:40.567Z
Task Summary: replace-me
Final Deliverable: report.md + run/*

## Current Status

- Active Tracks: A
- Active Entrypoints: EP-001
- Knowledge Cards: (none)
- Sync Status: restored-from-route-state

## Track Definitions

### A

- Target: 
- Inputs: 
- Output: 
- Priority: 
- Checkpoints: 

### B

- Target: 
- Inputs: 
- Output: 
- Priority: 
- Checkpoints: 

## Entrypoint Loop

- Principle: topics provide capabilities; entrypoints decide what to probe first.
- Parallel Limit: keep at most 1 to 2 active entrypoints.
- Pivot Rule: if a probe is ineffective, park or exhaust it, then switch or retrospective.

#### EP-001 先做最小成本分诊

- Hypothesis: 先用一个最便宜的观察性探针判断当前主阻塞更像 壳、动态 Dex、JNI、运行时防护或协议链路 还是协议编排问题。
- Bound Topics: 
- Target Track: A
- Rationale: 复合场景先做中性分诊，避免一开始就把某个 topic 误当成唯一主线。
- Cost: low
- Expected Gain: high
- Probe: 做一次最小观测：hook / input-boundary diff / request initiator trace 三选一，先确认下一刀切在哪条链路。
- Success Criteria: 能明确缩窄主阻塞点，或激活下一条更高价值的切入点。
- Failure Criteria: 没有带来新的可执行分歧，且不能支持下一步判断。
- Status: CANDIDATE
- Result Summary: 
- Next On Success: 扩展该切入点并绑定更具体的 topic。
- Next On Failure: 切到下一个候选切入点。
- Updated At: 

## Coordination Rules

- Update clues.md whenever a high-value clue or decisive evidence appears.
- Use route-state.json as the machine source of truth; markdown is a rendered view.
- Composite tasks should rank candidate entrypoints by cost and expected gain before expanding topics.

