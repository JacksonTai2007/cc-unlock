// cc-unlock for Codex — pure deploy logic (no Electron deps).
// Ports deploy.ps1's Deploy-Codex-* functions to Node. Testable / CLI-reusable.
// config.toml is manipulated with latin1 (byte passthrough) so CJK content from
// relay tools on Chinese Windows (GBK) is preserved byte-perfect — ASCII keys still regex.
'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// ---------------- Paths ----------------
const HOME = os.homedir();
const CODEX_DIR = path.join(HOME, '.codex');
const CONFIG_PATH = path.join(CODEX_DIR, 'config.toml');
const MEMORIES_DIR = path.join(CODEX_DIR, 'memories');
const ROLLOUT_DIR = path.join(MEMORIES_DIR, 'rollout_summaries');
const SKILLS_DIR = path.join(CODEX_DIR, 'skills');

const APP = __dirname;                                  // cc-unlock-codex/ (or app.asar when packaged)
const MONO = path.resolve(APP, '..');                   // cc-unlock/ (dev only)
// Packaged (electron-builder): bundles are unpacked under process.resourcesPath.
// Dev / plain-node test: process.resourcesPath is undefined or lacks the bundle -> monorepo layout.
const RES = process.resourcesPath;
const PACKAGED = !!(RES && fs.existsSync(path.join(RES, 'codex-files')));
const CODEX_FILES = PACKAGED ? path.join(RES, 'codex-files') : path.join(MONO, 'codex-files');
const CONFIG_BUNDLE = path.join(CODEX_FILES, 'codex-config-bundle');   // system-prompt.md, AGENTS.md, config.toml
const MEMORY_BUNDLE = path.join(CODEX_FILES, 'codex-memory-bundle');   // memory_summary.md, MEMORY.md, raw_memories.md
const ROLLOUT_BUNDLE = path.join(CODEX_FILES, 'codex-rollout-bundle', 'rollout_summaries');
const SKILL_BUNDLE = PACKAGED ? path.join(RES, 'skill-bundle') : path.join(MONO, 'cc-unlock-files', 'skill-bundle');

const SKILL_DIRS = ['loop-sec', 'android-reverse', 'web-reverse', 'win-reverse'];
const MEMORY_FILES = ['memory_summary.md', 'MEMORY.md', 'raw_memories.md'];
const INSTR_LINE = 'model_instructions_file = "system-prompt.md"';
const RELAY_HEADER = '[model_providers.cc_unlock_relay]';

const PATHS = { HOME, CODEX_DIR, CONFIG_PATH, MEMORIES_DIR, SKILLS_DIR, CODEX_FILES, CONFIG_BUNDLE, MEMORY_BUNDLE, ROLLOUT_BUNDLE, SKILL_BUNDLE };

// ---------------- FS helpers ----------------
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const ensureDir = (p) => { try { fs.mkdirSync(p, { recursive: true }); } catch {} };
const readLatin1 = (p) => fs.readFileSync(p, 'latin1');
const writeLatin1 = (p, s) => fs.writeFileSync(p, s, 'latin1');
function copyFile(src, dst) { try { fs.copyFileSync(src, dst); return true; } catch { return false; } }
function copyDir(src, dst) {
  try { if (exists(dst)) fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(src, dst, { recursive: true }); return true; }
  catch { return false; }
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); return true; } catch { return false; } }
function countFiles(dir) {
  let n = 0;
  const walk = (d) => { let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of e) { const fp = path.join(d, x.name); if (x.isDirectory()) walk(fp); else n++; } };
  if (exists(dir)) walk(dir);
  return n;
}

// ---------------- config.toml (latin1 byte-safe) ----------------
function setInstructionsFile(cfgPath, log) {
  if (!exists(cfgPath)) { writeLatin1(cfgPath, INSTR_LINE + '\n'); return true; }
  const text = readLatin1(cfgPath);
  if (/^model_instructions_file\s*=\s*"system-prompt\.md"/m.test(text)) return true;
  const kept = text.split(/\r?\n/).filter((l) => !/^\s*model_instructions_file\s*=/.test(l));
  let content = INSTR_LINE + '\n' + kept.join('\n');
  if (!content.endsWith('\n')) content += '\n';
  writeLatin1(cfgPath, content);
  return true;
}

function removeInstructionsFile(cfgPath) {
  if (!exists(cfgPath)) return 'absent';
  const text = readLatin1(cfgPath);
  const kept = text.split(/\r?\n/).filter((l) => !/^\s*model_instructions_file\s*=/.test(l));
  const joined = kept.join('\n').replace(/^\n+/, '');
  // if file now has only whitespace, remove it entirely
  if (!joined.trim()) { rmrf(cfgPath); return 'removed'; }
  writeLatin1(cfgPath, joined.endsWith('\n') ? joined : joined + '\n');
  return 'kept';
}

function deployRelayProvider(cfgPath, apiUrl, apiKey, model) {
  if (!exists(cfgPath)) writeLatin1(cfgPath, '');
  const text = readLatin1(cfgPath);
  const lines = text.split(/\r?\n/);
  const kept = [];
  let skip = false;
  for (const l of lines) {
    if (/^\[model_providers\.cc_unlock_relay\]/.test(l)) { skip = true; continue; }
    if (skip && /^\[/.test(l)) skip = false;
    if (!skip) kept.push(l);
  }
  const block = ['', RELAY_HEADER, 'name = "cc-unlock Relay"', `base_url = "${apiUrl}"`, 'wire_api = "responses"', 'requires_openai_auth = false'];
  if (apiKey) block.push(`api_key = "${apiKey}"`);
  if (model) block.push(`model = "${model}"`);
  const content = kept.join('\n').replace(/\n+$/, '') + '\n' + block.join('\n') + '\n';
  writeLatin1(cfgPath, content);
}

function removeRelayProvider(cfgPath) {
  if (!exists(cfgPath)) return;
  const text = readLatin1(cfgPath);
  if (!text.includes(RELAY_HEADER)) return;
  const lines = text.split(/\r?\n/);
  const kept = [];
  let skip = false;
  for (const l of lines) {
    if (/^\[model_providers\.cc_unlock_relay\]/.test(l)) { skip = true; continue; }
    if (skip && /^\[/.test(l)) skip = false;
    if (!skip) kept.push(l);
  }
  let content = kept.join('\n');
  if (!content.endsWith('\n')) content += '\n';
  writeLatin1(cfgPath, content);
}

// ---------------- Deploy ----------------
function deployCodex(opts, log) {
  opts = opts || {};
  ensureDir(CODEX_DIR);
  log('head', 'Codex 配置');

  // 1. AGENTS.md — 主人格载体，叠加在 Codex 内置 base instructions 之上（不替换）。
  //    不用 model_instructions_file 替换 base：那会顶掉 Codex 内置操作守则、卡死桌面版 startup
  //    （"正在完成 Windows 设置" 挂起）。AGENTS.md 是 Codex 的标准人格机制，startup 不受影响。
  const ag = path.join(CONFIG_BUNDLE, 'AGENTS.md');
  if (exists(ag) && copyFile(ag, path.join(CODEX_DIR, 'AGENTS.md')))
    log('ok', `AGENTS.md (${fs.statSync(path.join(CODEX_DIR, 'AGENTS.md')).size} bytes) — 人格`);

  // 2. config.toml — 移除 model_instructions_file（旧版遗留会替换 base prompt，修复卡死）。保留其它键。
  if (exists(CONFIG_PATH) && /model_instructions_file\s*=/.test(readLatin1(CONFIG_PATH))) {
    removeInstructionsFile(CONFIG_PATH);
    log('ok', 'config.toml — 已移除 model_instructions_file（不替换 base prompt，修复启动）');
  }

  // 2b. 清理 legacy system-prompt.md（人格已改由 AGENTS.md 承载，此文件不再被引用）
  if (exists(path.join(CODEX_DIR, 'system-prompt.md'))) {
    rmrf(path.join(CODEX_DIR, 'system-prompt.md'));
    log('info', 'cleaned legacy system-prompt.md');
  }

  // 3. relay provider (optional)
  if (opts.relayUrl) {
    deployRelayProvider(CONFIG_PATH, opts.relayUrl, opts.relayKey, opts.relayModel);
    log('ok', `relay provider: ${opts.relayUrl}`);
  }

  // 5. memories
  ensureDir(MEMORIES_DIR);
  let mc = 0;
  for (const f of MEMORY_FILES) {
    const s = path.join(MEMORY_BUNDLE, f);
    if (exists(s) && copyFile(s, path.join(MEMORIES_DIR, f))) mc++;
  }
  log('ok', `memories/ (${mc}) — persona + delivery many-shot`);

  // 6. rollout summaries
  if (exists(ROLLOUT_BUNDLE)) {
    if (copyDir(ROLLOUT_BUNDLE, ROLLOUT_DIR)) log('ok', `rollout_summaries/ (${countFiles(ROLLOUT_DIR)} files)`);
  }

  // 7. skills
  ensureDir(SKILLS_DIR);
  for (const d of SKILL_DIRS) {
    const s = path.join(SKILL_BUNDLE, d);
    if (exists(s) && copyDir(s, path.join(SKILLS_DIR, d))) log('ok', `skills/${d}/ (${countFiles(path.join(SKILLS_DIR, d))} files)`);
  }
}

function uninstallCodex(log) {
  if (!exists(CODEX_DIR)) { log('warn', '~/.codex 不存在'); return; }
  log('head', 'Codex 卸载');
  for (const f of ['system-prompt.md', 'AGENTS.md']) if (rmrf(path.join(CODEX_DIR, f))) log('ok', `removed ${f}`);
  removeRelayProvider(CONFIG_PATH);
  switch (removeInstructionsFile(CONFIG_PATH)) {
    case 'removed': log('ok', 'removed config.toml'); break;
    case 'kept': log('info', 'config.toml (保留其它设置)'); break;
  }
  for (const f of MEMORY_FILES) rmrf(path.join(MEMORIES_DIR, f));
  rmrf(ROLLOUT_DIR);
  for (const d of SKILL_DIRS) rmrf(path.join(SKILLS_DIR, d));
  log('ok', 'removed memories + rollouts + skills');
}

function verifyCodex(log) {
  log('head', 'Codex 验证');
  const ag = path.join(CODEX_DIR, 'AGENTS.md');
  log(exists(ag) ? 'ok' : 'fail', `AGENTS.md ${exists(ag) ? `(${fs.statSync(ag).size} b) — 人格` : 'MISSING'}`);
  const noInstr = !(exists(CONFIG_PATH) && /model_instructions_file\s*=/.test(readLatin1(CONFIG_PATH)));
  log(noInstr ? 'ok' : 'warn', `config.toml — base prompt 完整${noInstr ? '（未被替换）' : '（仍有 model_instructions_file，应移除）'}`);
  const mOk = MEMORY_FILES.filter((f) => exists(path.join(MEMORIES_DIR, f))).length;
  log(mOk === MEMORY_FILES.length ? 'ok' : 'warn', `memories ${mOk}/${MEMORY_FILES.length}`);
  const sOk = SKILL_DIRS.filter((d) => exists(path.join(SKILLS_DIR, d))).length;
  log(sOk === SKILL_DIRS.length ? 'ok' : 'warn', `skills ${sOk}/${SKILL_DIRS.length}`);
  const rc = countFiles(ROLLOUT_DIR);
  log(rc > 0 ? 'ok' : 'warn', `rollout_summaries ${rc} files`);
}

// ---------------- Detection ----------------
function detectVersion() {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const bin = isWin ? 'cmd' : 'codex';
    const args = isWin ? ['/c', 'codex', '--version'] : ['--version'];
    try {
      execFile(bin, args, { timeout: 4000, windowsHide: true }, (err, out) => {
        if (err || !out) return resolve(null);
        const m = String(out).match(/(\d+\.\d+\.\d+)/);
        resolve(m ? m[1] : String(out).trim().slice(0, 20));
      });
    } catch { resolve(null); }
  });
}

async function detect() {
  const relay = exists(CONFIG_PATH) && readLatin1(CONFIG_PATH).includes(RELAY_HEADER);
  const baseIntact = !(exists(CONFIG_PATH) && /model_instructions_file\s*=/.test(readLatin1(CONFIG_PATH)));
  const liveAgents = exists(path.join(CODEX_DIR, 'AGENTS.md'));
  return {
    codexInstalled: exists(CODEX_DIR),
    codexVersion: (await detectVersion()) || '?',
    configPresent: exists(CONFIG_PATH),
    baseIntact,                    // true = config.toml 未用 model_instructions_file 替换 base prompt
    deployed: liveAgents,          // AGENTS.md 就位即视为已部署人格
    relayConfigured: relay,
    agentsBundle: exists(path.join(CONFIG_BUNDLE, 'AGENTS.md')),
    memFiles: MEMORY_FILES.filter((f) => exists(path.join(MEMORY_BUNDLE, f))).length,
    rolloutFiles: countFiles(ROLLOUT_BUNDLE),
    skillDirs: SKILL_DIRS.filter((d) => exists(path.join(SKILL_BUNDLE, d))).length,
    // live status
    liveAgents,
    liveMem: MEMORY_FILES.filter((f) => exists(path.join(MEMORIES_DIR, f))).length,
    liveSkills: SKILL_DIRS.filter((d) => exists(path.join(SKILLS_DIR, d))).length,
    liveRollouts: countFiles(ROLLOUT_DIR),
  };
}

module.exports = {
  PATHS, SKILL_DIRS, MEMORY_FILES, exists,
  setInstructionsFile, removeInstructionsFile, deployRelayProvider, removeRelayProvider,
  deployCodex, uninstallCodex, verifyCodex, detect,
};
