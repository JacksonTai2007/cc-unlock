import os from "node:os";

const tierRank = {
  fast: 0,
  full: 1,
  deep: 2
};

export const checkManifest = [
  { name: "check-utf8.mjs", tier: "fast", estimatedMs: 200 },
  { name: "check-naming.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-template.mjs", tier: "fast", estimatedMs: 200 },
  { name: "check-bridge-docs.mjs", tier: "fast", estimatedMs: 120 },
  { name: "check-websearch-contract.mjs", tier: "fast", estimatedMs: 140 },
  { name: "check-external-research-sync.mjs", tier: "fast", estimatedMs: 3500, exclusive: true },
  { name: "check-prompt-coverage.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-topic-manifest-sync.mjs", tier: "fast", estimatedMs: 180 },
  { name: "check-doc-fact-sync.mjs", tier: "fast", estimatedMs: 180 },
  { name: "check-operating-contracts.mjs", tier: "fast", estimatedMs: 120 },
  { name: "check-task-packs.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-task-semantics.mjs", tier: "fast", estimatedMs: 800 },
  { name: "check-task-init-contract.mjs", tier: "fast", estimatedMs: 1000 },
  { name: "check-task-start-contract.mjs", tier: "fast", estimatedMs: 1000 },
  { name: "check-contract-validation.mjs", tier: "fast", estimatedMs: 20000 },
  { name: "check-delivery-authenticity.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-progress-chatter.mjs", tier: "fast", estimatedMs: 100 },
  { name: "check-rollout-auto-continue.mjs", tier: "fast", estimatedMs: 120 },
  { name: "check-rollout-governance.mjs", tier: "fast", estimatedMs: 250 },
  { name: "check-execution-discipline.mjs", tier: "fast", estimatedMs: 120 },
  { name: "check-hook-discipline.mjs", tier: "fast", estimatedMs: 120 },
  { name: "check-behavioral-enforcement.mjs", tier: "fast", estimatedMs: 120 },
  { name: "check-eval-regression.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-reasoning-regression.mjs", tier: "fast", estimatedMs: 120 },
  { name: "check-capability-coverage.mjs", tier: "fast", estimatedMs: 200 },
  { name: "check-specialized-strength.mjs", tier: "fast", estimatedMs: 200 },
  { name: "check-maturity-consistency.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-skill-contract.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-algo-selfcheck.mjs", tier: "fast", estimatedMs: 200 },
  { name: "lint-cases.mjs", tier: "fast", estimatedMs: 150 },
  { name: "check-deliverables.mjs", tier: "full", estimatedMs: 250000 },
  { name: "check-route-authority.mjs", tier: "full", estimatedMs: 4000 },
  { name: "check-route-consistency.mjs", tier: "full", estimatedMs: 230000 },
  { name: "check-task-tool-discipline.mjs", tier: "full", estimatedMs: 5000 },
  { name: "check-external-workspace-lifecycle.mjs", tier: "deep", estimatedMs: 260000 },
  { name: "check-auto-advance-contract.mjs", tier: "deep", estimatedMs: 15000 },
  { name: "check-reply-gate-contract.mjs", tier: "deep", estimatedMs: 15000 },
  { name: "check-evidence-closeout.mjs", tier: "deep", estimatedMs: 130000, exclusive: true },
  { name: "check-synthetic-e2e.mjs", tier: "deep", estimatedMs: 560000 }
];

export const supportedCheckGroups = ["fast", "full", "deep", "all"];

export function normalizeCheckGroup(group = "all") {
  const normalized = String(group || "all").trim().toLowerCase();
  return supportedCheckGroups.includes(normalized) ? normalized : null;
}

export function getChecksForGroup(group = "all") {
  const normalized = normalizeCheckGroup(group);
  if (!normalized) {
    throw new Error(`unknown check group: ${group}`);
  }

  const maxRank = normalized === "fast"
    ? tierRank.fast
    : normalized === "full"
    ? tierRank.full
    : tierRank.deep;

  return checkManifest.filter((item) => tierRank[item.tier] <= maxRank);
}

export function defaultJobsForGroup(group = "all") {
  const normalized = normalizeCheckGroup(group) || "all";
  const available = typeof os.availableParallelism === "function"
    ? os.availableParallelism()
    : 4;
  const reserve = available > 2 ? 1 : 0;
  const suggested = Math.max(1, available - reserve);
  const cap = normalized === "fast" ? 4 : normalized === "full" ? 4 : 3;
  return Math.max(1, Math.min(cap, suggested));
}
