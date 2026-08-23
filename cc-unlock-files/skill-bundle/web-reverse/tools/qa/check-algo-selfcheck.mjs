import fs from "node:fs";
import path from "node:path";
import { exists, failWith, readText, rel, repoRoot, walk } from "./common.mjs";

// check-algo-selfcheck —— 守护从 nweb-reverse 吸收的「控制变量算法自检 + 双闸门」资产，
// 并对采用了双闸门的 fixtures 强制 self-check 形状。
//
// 设计为零爆炸半径的硬门禁：
//   - 资产存在性：脚本/playbook 被静默删除 → BLOCK。
//   - 契约同步：SKILL.md 与 playbook 必须记录 generate(ctx, pinned=...) 统一签名。
//   - fixtures 双闸门契约：任何 run/fixtures.json 条目一旦含 `pinned`（即采用了控制变量自检），
//     就【必须】同时含 `ctx` 与 `expected`（verify-algo.py 的逐字节比对三元组）。
//     未采用 pinned 的 fixtures（今日模板/合成 e2e 现状）天然豁免 → 不破坏既有 21+ 专题。

const findings = [];

// 1. 资产存在性（防止吸收成果被静默回退）
const REQUIRED_ASSETS = [
  "scripts/verify/verify-algo.py",
  "scripts/verify/verify-offline.py",
  "scripts/env/proxy-env.cjs",
  "scripts/deob/deob-ob.cjs",
  "scripts/vm/jsvmp-instrument.cjs",
  "scripts/captcha/slide-gap.py",
  "scripts/captcha/track-gen.py",
  "scripts/captcha/geetest-w.py",
  "references/algorithm-selfcheck-playbook.md",
  "references/captcha-slider-playbook.md"
];
for (const asset of REQUIRED_ASSETS) {
  if (!exists(asset)) {
    findings.push(`absorbed asset missing: ${asset}（nweb-reverse 吸收成果不得静默删除）`);
  }
}

// 2. 统一实现契约 generate(ctx, pinned=...) 必须在 SKILL.md 与 playbook 同步出现
const CONTRACT_PATTERN = /generate\(ctx,\s*pinned/;
for (const doc of ["SKILL.md", "references/algorithm-selfcheck-playbook.md"]) {
  if (exists(doc) && !CONTRACT_PATTERN.test(readText(doc))) {
    findings.push(`${doc} must document the unified self-check contract generate(ctx, pinned=None)`);
  }
}

// playbook 必须同时点名两道闸门脚本，避免文档与脚本漂移
if (exists("references/algorithm-selfcheck-playbook.md")) {
  const text = readText("references/algorithm-selfcheck-playbook.md");
  for (const needle of ["verify-algo.py", "verify-offline.py"]) {
    if (!text.includes(needle)) {
      findings.push(`algorithm-selfcheck-playbook.md must reference ${needle}`);
    }
  }
}

// 3. 双闸门 fixtures 契约：含 pinned 的条目必须是完整 self-check 三元组
function checkFixturesFile(absPath) {
  const relPath = rel(absPath);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch {
    return; // 非 JSON / 解析失败交由其它检查处理，这里不重复报错
  }
  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.cases)
    ? parsed.cases
    : [];
  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(entry, "pinned")) {
      return; // 未采用控制变量自检 → 豁免
    }
    for (const required of ["ctx", "expected"]) {
      if (!Object.prototype.hasOwnProperty.call(entry, required)) {
        findings.push(
          `${relPath} 条目[${index}] 含 pinned（控制变量自检）但缺少 "${required}"：` +
            `verify-algo.py 要求 {ctx, pinned, expected} 三元组完整`
        );
      }
    }
  });
}

for (const entry of walk(repoRoot, {
  includeFiles: true,
  includeDirs: false,
  skip: new Set(["dist", "node_modules", ".git", ".idea", ".vscode", ".history", ".skill-audit"])
})) {
  if (path.basename(entry) === "fixtures.json") {
    checkFixturesFile(entry);
  }
}

failWith(findings, "check-algo-selfcheck");
