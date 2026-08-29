// cc-unlock for Claude Code — pure deploy logic (no Electron deps).
// Used by main.js (IPC) and testable / CLI-reusable standalone via Node.
'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// ---------------- Paths ----------------
const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const PROJECTS = path.join(CLAUDE_DIR, 'projects');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');

// APP dir is where this module lives (cc-unlock-claude/)
const APP = __dirname;
const MONO = path.resolve(APP, '..');               // cc-unlock/
const CCF = path.join(MONO, 'cc-unlock-files');
const MEMORY_BUNDLE = path.join(CCF, 'memory-bundle');
const SKILL_BUNDLE = path.join(CCF, 'skill-bundle');
const CONFIG_BUNDLE = path.join(CCF, 'config-bundle');
const AGENTS_BUNDLE = path.join(APP, 'bundle', 'agents');
const RULES_BUNDLE = path.join(APP, 'bundle', 'rules');
const AGENT_MEMORY_BUNDLE = path.join(APP, 'bundle', 'agent-memory');

const SKILL_DIRS = ['loop-sec', 'android-reverse', 'web-reverse', 'win-reverse'];
const INDEX_FILE = 'MEMORY.md';
const RULES_FILE = 'cc-unlock-persona.md';

const PATHS = { HOME, CLAUDE_DIR, PROJECTS, SETTINGS_PATH, CCF, MEMORY_BUNDLE, SKILL_BUNDLE, CONFIG_BUNDLE, AGENTS_BUNDLE, RULES_BUNDLE, AGENT_MEMORY_BUNDLE };

// Custom agent names (from agent bundle filenames) — each gets its own agent-memory carrier.
function agentNames() { return agentBundleFiles().map((f) => f.replace(/\.md$/i, '')); }

// ---------------- FS helpers ----------------
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const ensureDir = (p) => { try { fs.mkdirSync(p, { recursive: true }); } catch {} };
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n', 'utf8');

function copyFile(src, dst) { try { fs.copyFileSync(src, dst); return true; } catch { return false; } }
function copyDir(src, dst) {
  try {
    if (exists(dst)) fs.rmSync(dst, { recursive: true, force: true });
    fs.cpSync(src, dst, { recursive: true });
    return true;
  } catch { return false; }
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); return true; } catch { return false; } }
function listMd(dir) { try { return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md')); } catch { return []; } }
function countFiles(dir) {
  let n = 0;
  const walk = (d) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) { const fp = path.join(d, e.name); if (e.isDirectory()) walk(fp); else n++; }
  };
  if (exists(dir)) walk(dir);
  return n;
}

// ---------------- Project <-> workspace mapping ----------------
function projectName(wsPath) {
  const resolved = path.resolve(wsPath).replace(/[\\/]+$/, '');
  return resolved.replace(/:/g, '-').replace(/[\\/]/g, '-').replace(/ /g, '-');
}
function memoryDirFor(projName) { return path.join(PROJECTS, projName, 'memory'); }

function resolveWorkspace(projName) {
  const direct = projName.replace(/^([A-Za-z])-/, '$1:\\').replace(/-/g, '\\');
  if (exists(direct)) return direct;
  const roots = [
    path.join(HOME, 'Desktop'), path.join(HOME, 'Documents'),
    path.join(HOME, 'Projects'), path.join(HOME, 'source', 'repos'),
    path.join(HOME, 'workspace'), HOME,
  ].filter(exists);
  const maxDepth = 4;
  for (const root of roots) {
    const stack = [{ p: root, d: 0 }];
    while (stack.length) {
      const { p, d } = stack.pop();
      try { if (projectName(p) === projName) return p; } catch {}
      if (d >= maxDepth) continue;
      let ents = [];
      try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) if (e.isDirectory()) stack.push({ p: path.join(p, e.name), d: d + 1 });
    }
  }
  return null;
}

// ---------------- Bundle inventory ----------------
function memoryBundleFiles() { return listMd(MEMORY_BUNDLE).filter((f) => f !== INDEX_FILE && f !== 'CLAUDE.md'); }
function agentBundleFiles() { return listMd(AGENTS_BUNDLE); }

// ---------------- Deploy ----------------
function deployWorkspace(wsPath, opts, log) {
  const projName = projectName(wsPath);
  const memDir = memoryDirFor(projName);
  log('head', `部署: ${wsPath}`);
  ensureDir(memDir);

  let ok = 0;
  for (const f of memoryBundleFiles()) {
    if (copyFile(path.join(MEMORY_BUNDLE, f), path.join(memDir, f))) ok++; else log('fail', f);
  }
  log('ok', `${ok} memory files -> projects/${projName}/memory/`);

  if (exists(path.join(MEMORY_BUNDLE, INDEX_FILE))) {
    copyFile(path.join(MEMORY_BUNDLE, INDEX_FILE), path.join(memDir, INDEX_FILE));
    log('ok', 'MEMORY.md (index / 反拒绝载体)');
  }

  if (exists(path.join(MEMORY_BUNDLE, 'CLAUDE.md'))) {
    if (copyFile(path.join(MEMORY_BUNDLE, 'CLAUDE.md'), path.join(wsPath, 'CLAUDE.md')))
      log('ok', 'CLAUDE.md -> workspace root');
  }

  const skillDir = path.join(wsPath, '.claude', 'skills');
  ensureDir(skillDir);
  for (const d of SKILL_DIRS) {
    const src = path.join(SKILL_BUNDLE, d);
    if (exists(src) && copyDir(src, path.join(skillDir, d)))
      log('ok', `skills/${d}/ (${countFiles(path.join(skillDir, d))} files)`);
  }

  if (opts && opts.subagent) {
    // 5a. custom agents (persona in body)
    const agentsDir = path.join(wsPath, '.claude', 'agents');
    ensureDir(agentsDir);
    let acount = 0;
    for (const f of agentBundleFiles()) if (copyFile(path.join(AGENTS_BUNDLE, f), path.join(agentsDir, f))) acount++;
    log('ok', `.claude/agents/ (${acount}) — persona body`);

    // 5b. rules file (no paths: -> loads into main + all non-fork subagents at startup)
    const rulesSrc = path.join(RULES_BUNDLE, RULES_FILE);
    if (exists(rulesSrc)) {
      const rulesDir = path.join(wsPath, '.claude', 'rules');
      ensureDir(rulesDir);
      if (copyFile(rulesSrc, path.join(rulesDir, RULES_FILE))) log('ok', `.claude/rules/${RULES_FILE} — 主+子agent 载体`);
    }

    // 5c. per-agent memory carrier (memory:project -> .claude/agent-memory/<name>/MEMORY.md, auto-injected)
    const memSeed = path.join(AGENT_MEMORY_BUNDLE, INDEX_FILE);
    if (exists(memSeed)) {
      let mc = 0;
      for (const name of agentNames()) {
        const dir = path.join(wsPath, '.claude', 'agent-memory', name);
        ensureDir(dir);
        if (copyFile(memSeed, path.join(dir, INDEX_FILE))) mc++;
      }
      log('ok', `.claude/agent-memory/*/MEMORY.md (${mc}) — 反拒绝 many-shot 注入子agent`);
    }
  } else {
    log('warn', 'skip 子 agent 覆盖 (agents/rules/agent-memory 关闭)');
  }
}

function uninstallWorkspace(wsPath, log) {
  const projName = projectName(wsPath);
  const memDir = memoryDirFor(projName);
  log('head', `卸载: ${wsPath}`);
  let removed = 0;
  for (const f of memoryBundleFiles().concat([INDEX_FILE])) if (rmrf(path.join(memDir, f))) removed++;
  log('ok', `removed ${removed} memory files`);
  if (rmrf(path.join(wsPath, 'CLAUDE.md'))) log('ok', 'removed CLAUDE.md');
  for (const d of SKILL_DIRS) rmrf(path.join(wsPath, '.claude', 'skills', d));
  for (const f of agentBundleFiles()) rmrf(path.join(wsPath, '.claude', 'agents', f));
  rmrf(path.join(wsPath, '.claude', 'rules', RULES_FILE));
  for (const name of agentNames()) rmrf(path.join(wsPath, '.claude', 'agent-memory', name));
  log('ok', 'removed skills + agents + rules + agent-memory');
}

function verifyWorkspace(wsPath, log) {
  const projName = projectName(wsPath);
  const memDir = memoryDirFor(projName);
  log('head', `验证: ${wsPath}`);
  const want = memoryBundleFiles();
  const have = want.filter((f) => exists(path.join(memDir, f))).length;
  log(have === want.length ? 'ok' : 'warn', `memory ${have}/${want.length}`);
  log(exists(path.join(wsPath, 'CLAUDE.md')) ? 'ok' : 'fail', 'CLAUDE.md');
  const skillsOk = SKILL_DIRS.filter((d) => exists(path.join(wsPath, '.claude', 'skills', d))).length;
  log(skillsOk === SKILL_DIRS.length ? 'ok' : 'warn', `skills ${skillsOk}/${SKILL_DIRS.length}`);
  const agentsWant = agentBundleFiles();
  const agentsOk = agentsWant.filter((f) => exists(path.join(wsPath, '.claude', 'agents', f))).length;
  log(agentsOk === agentsWant.length ? 'ok' : 'warn', `agents ${agentsOk}/${agentsWant.length}`);
  const rulesOk = exists(path.join(wsPath, '.claude', 'rules', RULES_FILE));
  log(rulesOk ? 'ok' : 'warn', `rules ${rulesOk ? '1/1' : '0/1'} (主+子agent 载体)`);
  const amWant = agentNames();
  const amOk = amWant.filter((n) => exists(path.join(wsPath, '.claude', 'agent-memory', n, INDEX_FILE))).length;
  log(amOk === amWant.length ? 'ok' : 'warn', `agent-memory ${amOk}/${amWant.length} (子agent many-shot)`);
}

function deploySettings(log) {
  const src = readJson(path.join(CONFIG_BUNDLE, 'settings.json'));
  if (!src) return;
  ensureDir(CLAUDE_DIR);
  const cur = exists(SETTINGS_PATH) ? (readJson(SETTINGS_PATH) || {}) : {};
  cur.effortLevel = src.effortLevel;
  cur.skipDangerousModePermissionPrompt = src.skipDangerousModePermissionPrompt;
  cur.permissions = Object.assign({}, cur.permissions, src.permissions);
  cur.env = Object.assign({}, cur.env, src.env);
  writeJson(SETTINGS_PATH, cur);
  log('ok', 'settings.json (bypassPermissions, merged)');
}

// ---------------- Detection / listing ----------------
function detectVersion() {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    // Node 24 blocks spawning .cmd/.bat directly (EINVAL). Route through cmd /c on Windows.
    const bin = isWin ? 'cmd' : 'claude';
    const args = isWin ? ['/c', 'claude', '--version'] : ['--version'];
    try {
      execFile(bin, args, { timeout: 4000, windowsHide: true }, (err, out) => {
        if (err || !out) return resolve(null);
        const m = String(out).match(/(\d+\.\d+\.\d+)/);
        resolve(m ? m[1] : String(out).trim().slice(0, 20));
      });
    } catch { resolve(null); }
  });
}

function listWorkspaces() {
  const out = [];
  let dirs = [];
  try { dirs = fs.readdirSync(PROJECTS, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch {}
  const wantMem = memoryBundleFiles();
  for (const e of dirs) {
    const projName = e.name;
    const memDir = path.join(PROJECTS, projName, 'memory');
    const deployed = exists(path.join(memDir, INDEX_FILE)) || wantMem.some((f) => exists(path.join(memDir, f)));
    const wsPath = resolveWorkspace(projName);
    let subagent = false;
    if (wsPath) {
      const ad = path.join(wsPath, '.claude', 'agents');
      subagent = agentBundleFiles().some((f) => exists(path.join(ad, f)));
    }
    out.push({ name: projName, path: wsPath || projName, resolved: !!wsPath, deployed, subagent });
  }
  out.sort((a, b) => (b.deployed - a.deployed) || a.name.localeCompare(b.name));
  return out;
}

async function detect() {
  const ws = listWorkspaces();
  return {
    ccInstalled: exists(CLAUDE_DIR),
    ccVersion: (await detectVersion()) || '?',
    settings: exists(SETTINGS_PATH),
    deployedCount: ws.filter((w) => w.deployed).length,
    subagentCount: ws.filter((w) => w.subagent).length,
    memFiles: memoryBundleFiles().length + (exists(path.join(MEMORY_BUNDLE, INDEX_FILE)) ? 1 : 0),
    skillDirs: SKILL_DIRS.filter((d) => exists(path.join(SKILL_BUNDLE, d))).length,
    agentFiles: agentBundleFiles().length,
    claudeMd: exists(path.join(MEMORY_BUNDLE, 'CLAUDE.md')),
    bundleOk: exists(MEMORY_BUNDLE) && exists(SKILL_BUNDLE),
  };
}

function resolveTargets(targets) {
  const all = listWorkspaces();
  const byName = new Map(all.map((w) => [w.name, w]));
  return (targets || []).map((t) => {
    const key = typeof t === 'string' ? t : (t.name || t.path);
    if (byName.has(key)) return byName.get(key);
    const raw = typeof t === 'string' ? t : (t.path || t.name);
    return { name: projectName(raw), path: raw, resolved: exists(raw), deployed: false, subagent: false };
  });
}

module.exports = {
  PATHS, SKILL_DIRS,
  exists, projectName, resolveWorkspace,
  memoryBundleFiles, agentBundleFiles,
  deployWorkspace, uninstallWorkspace, verifyWorkspace, deploySettings,
  detect, listWorkspaces, resolveTargets,
};
