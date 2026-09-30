// Native Claude deployment: workspace instructions and explicitly selected skills only.
'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, '.claude');
const PROJECTS = path.join(CLAUDE_DIR, 'projects');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const CCF = path.resolve(__dirname, '..', 'cc-unlock-files');
// Electron also defines resourcesPath in development; only an app inside it is packaged.
const resourceRelative = process.resourcesPath ? path.relative(path.resolve(process.resourcesPath), __dirname) : null;
const PACKAGED = resourceRelative !== null && !path.isAbsolute(resourceRelative) &&
  resourceRelative !== '..' && !resourceRelative.startsWith('..' + path.sep);
const CONFIG_BUNDLE = path.join(PACKAGED ? process.resourcesPath : CCF, 'claude-config-bundle');
const SKILL_BUNDLE = path.join(PACKAGED ? process.resourcesPath : CCF, 'skill-bundle');
const PATHS = { HOME, CLAUDE_DIR, PROJECTS, SETTINGS_PATH, CCF, CONFIG_BUNDLE, SKILL_BUNDLE,
  CLAUDE_MD: path.join(CONFIG_BUNDLE, 'CLAUDE.md') };
const SKILL_DIRS = ['sec-forge'];
const STATE_NAME = 'claude-minimal-v1.json';
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const logger = (log) => typeof log === 'function' ? log : () => {};
const statePath = (ws) => path.join(ws, '.claude', '.cc-unlock-state', STATE_NAME);

function statOrNull(file) {
  try { return fs.lstatSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// A workspace or skill junction must not redirect deployment into another location.
function assertNoLinks(file) {
  const full = path.resolve(file);
  let current = path.parse(full).root;
  for (const part of full.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const st = statOrNull(current);
    if (!st) break;
    if (st.isSymbolicLink()) throw new Error(`SYMLINK_OR_JUNCTION: ${current}`);
  }
  return full;
}

function workspace(wsPath) {
  if (typeof wsPath !== 'string' || !path.isAbsolute(wsPath)) throw new Error('WORKSPACE_PATH_REQUIRED');
  const ws = assertNoLinks(wsPath);
  const st = statOrNull(ws);
  if (!st || !st.isDirectory()) throw new Error(`WORKSPACE_NOT_DIRECTORY: ${ws}`);
  return ws;
}

function readBytes(file) {
  assertNoLinks(file);
  const st = statOrNull(file);
  if (!st) return null;
  if (!st.isFile()) throw new Error(`EXPECTED_FILE: ${file}`);
  return fs.readFileSync(file);
}

function writeBytes(file, bytes) {
  assertNoLinks(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  assertNoLinks(file);
  fs.writeFileSync(file, bytes);
}

function validRelative(rel) {
  if (typeof rel !== 'string' || rel.includes('\\') || rel.includes(':') || rel.includes('\0')) return false;
  if (rel.split('/').some((p) => !p || p === '.' || p === '..')) return false;
  return rel === 'CLAUDE.md' || rel.startsWith('.claude/skills/sec-forge/');
}

function loadState(ws) {
  const bytes = readBytes(statePath(ws));
  if (!bytes) return { version: 1, workspace: ws, files: [] };
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('INVALID_OWNERSHIP_STATE: invalid JSON'); }
  if (value.version !== 1 || value.workspace !== ws || !Array.isArray(value.files))
    throw new Error('INVALID_OWNERSHIP_STATE: schema or workspace');
  const seen = new Set();
  for (const item of value.files) {
    if (!item || !validRelative(item.path) || seen.has(item.path.toLowerCase()) ||
        !/^[a-f0-9]{64}$/.test(item.writtenHash) || typeof item.existed !== 'boolean')
      throw new Error('INVALID_OWNERSHIP_STATE: file entry');
    seen.add(item.path.toLowerCase());
    if (item.existed && (typeof item.originalBase64 !== 'string' ||
        hash(Buffer.from(item.originalBase64, 'base64')) !== item.originalHash))
      throw new Error(`INVALID_OWNERSHIP_STATE: original bytes ${item.path}`);
  }
  return value;
}

function saveState(ws, state) {
  writeBytes(statePath(ws), Buffer.from(JSON.stringify(state, null, 2) + '\n'));
}

function bundleFiles() {
  const prompt = readBytes(PATHS.CLAUDE_MD);
  if (!prompt || prompt.length === 0) throw new Error(`MISSING_CLAUDE_BUNDLE: ${PATHS.CLAUDE_MD}`);
  const skillRoot = path.join(SKILL_BUNDLE, 'sec-forge');
  if (!readBytes(path.join(skillRoot, 'SKILL.md'))) throw new Error(`MISSING_SKILL_BUNDLE: ${skillRoot}`);
  const files = [{ path: 'CLAUDE.md', bytes: prompt }];
  function walk(dir, rel) {
    assertNoLinks(dir);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const src = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`SYMLINK_OR_JUNCTION: ${src}`);
      if (entry.isDirectory()) walk(src, rel + '/' + entry.name);
      else if (entry.isFile()) files.push({ path: rel + '/' + entry.name, bytes: readBytes(src) });
      else throw new Error(`UNSUPPORTED_BUNDLE_ENTRY: ${src}`);
    }
  }
  walk(skillRoot, '.claude/skills/sec-forge');
  if (files.some((f) => !validRelative(f.path))) throw new Error('INVALID_BUNDLE_PATH');
  return files;
}

function deployWorkspace(wsPath, _opts, log) {
  log = logger(log);
  const ws = workspace(wsPath);
  const desired = bundleFiles();
  const state = loadState(ws);
  const byPath = new Map(state.files.map((item) => [item.path, item]));
  const changes = [];
  log('head', `部署: ${ws}`);

  // Finish every conflict check before writing the prompt or any skill file.
  for (const item of desired) {
    const dest = path.join(ws, ...item.path.split('/'));
    const before = readBytes(dest);
    const owned = byPath.get(item.path);
    const digest = hash(item.bytes);
    if (owned && before !== null && hash(before) !== owned.writtenHash)
      throw new Error(`USER_MODIFIED_FILE: ${dest}`);
    if (!owned && item.path !== 'CLAUDE.md' && before !== null && hash(before) !== digest)
      throw new Error(`EXISTING_SKILL_CONFLICT: ${dest}`);
    const record = owned ? { ...owned, writtenHash: digest } : {
      path: item.path, writtenHash: digest, existed: before !== null,
      ...(before === null ? {} : { originalBase64: before.toString('base64'), originalHash: hash(before) }),
    };
    byPath.set(item.path, record);
    changes.push({ ...item, dest, before });
  }

  const previousState = readBytes(statePath(ws));
  const applied = [];
  try {
    for (const item of changes) {
      if (item.before !== null && item.before.equals(item.bytes)) continue;
      applied.push(item);
      writeBytes(item.dest, item.bytes);
    }
    state.files = [...byPath.values()];
    saveState(ws, state);
  } catch (error) {
    const rollbackErrors = [];
    for (const item of applied.reverse()) {
      try {
        if (item.before === null) { assertNoLinks(item.dest); fs.rmSync(item.dest, { force: true }); }
        else writeBytes(item.dest, item.before);
      } catch (undo) { rollbackErrors.push(`${item.dest}: ${undo.message}`); }
    }
    try {
      if (previousState === null) { assertNoLinks(statePath(ws)); fs.rmSync(statePath(ws), { force: true }); }
      else writeBytes(statePath(ws), previousState);
    } catch (undo) { rollbackErrors.push(`${statePath(ws)}: ${undo.message}`); }
    throw new Error(`${error.message}${rollbackErrors.length ? '; ROLLBACK_INCOMPLETE: ' + rollbackErrors.join('; ') : '; writes rolled back'}`);
  }
  log('ok', `CLAUDE.md + sec-forge (${desired.length - 1} skill files)`);
  log('info', '不部署 memory、子 agent、rules；不修改全局设置、CLI 或环境变量。');
  return { ok: true, prompt: path.join(ws, 'CLAUDE.md'), skillFiles: desired.length - 1,
    changed: applied.length, statePath: statePath(ws) };
}

function restoreOwned(wsPath, promptOnly, log) {
  log = logger(log);
  const ws = workspace(wsPath);
  const state = loadState(ws);
  const selected = state.files.filter((f) => !promptOnly || f.path === 'CLAUDE.md');
  if (selected.length === 0) {
    log('warn', '没有本版本管理的部署记录；未修改文件。');
    return { ok: true, results: [], skipped: [], noState: true };
  }
  const results = [], skipped = [], retained = [];
  for (const item of state.files) {
    if (promptOnly && item.path !== 'CLAUDE.md') { retained.push(item); continue; }
    const dest = path.join(ws, ...item.path.split('/'));
    try {
      const current = readBytes(dest);
      // Missing files may represent a user deletion; never resurrect them during cleanup.
      if (current === null) {
        results.push({ path: dest, action: 'already-absent' });
        continue;
      }
      if (hash(current) !== item.writtenHash) {
        retained.push(item); skipped.push(dest);
        log('warn', `保留用户修改: ${dest}`);
        continue;
      }
      if (item.existed) writeBytes(dest, Buffer.from(item.originalBase64, 'base64'));
      else { assertNoLinks(dest); fs.rmSync(dest); }
      const action = item.existed ? 'restored' : 'removed';
      results.push({ path: dest, action });
      log('ok', `${action}: ${dest}`);
    } catch (error) {
      retained.push(item); skipped.push(dest);
      results.push({ path: dest, action: 'fail', error: error.message });
      log('fail', `${dest}: ${error.message}`);
    }
  }
  state.files = retained;
  saveState(ws, state);
  return { ok: skipped.length === 0, results, skipped };
}

function uninstallWorkspace(wsPath, log) { return restoreOwned(wsPath, false, log); }
// Old versions' manifests can include personal memory and agents. Never consume them.
function restoreWorkspace(wsPath, log) { return restoreOwned(wsPath, true, log); }

function verifyWorkspace(wsPath, log) {
  log = logger(log);
  const ws = workspace(wsPath);
  const files = bundleFiles().map((item) => {
    const dest = path.join(ws, ...item.path.split('/'));
    const bytes = readBytes(dest);
    const ok = bytes !== null && hash(bytes) === hash(item.bytes);
    log(ok ? 'ok' : 'warn', `${item.path}: ${ok ? 'match' : 'missing or different'}`);
    return { path: dest, ok };
  });
  return { ok: files.every((f) => f.ok), files };
}

function deploySettings(log) {
  logger(log)('info', '保留 Claude 原生设置；未修改 settings.json 或环境变量。');
  return { ok: true, skipped: true };
}

function projectName(wsPath) {
  return path.resolve(wsPath).replace(/[\\/]+$/, '').replace(/:/g, '-').replace(/[\\/]/g, '-').replace(/ /g, '-');
}

function resolveWorkspace(projName) {
  const direct = projName.replace(/^([A-Za-z])-/, '$1:\\').replace(/-/g, '\\');
  if (exists(direct) && projectName(direct) === projName) return path.resolve(direct);
  const roots = [path.join(HOME, 'Desktop'), path.join(HOME, 'Documents'), path.join(HOME, 'Projects'),
    path.join(HOME, 'source', 'repos'), path.join(HOME, 'workspace'), HOME];
  const seen = new Set();
  for (const root of roots) {
    if (!exists(root)) continue;
    const stack = [{ p: root, depth: 0 }];
    while (stack.length) {
      const { p, depth } = stack.pop();
      if (seen.has(p)) continue;
      seen.add(p);
      if (projectName(p) === projName) return p;
      if (depth >= 4) continue;
      let entries;
      try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        if (e.isDirectory() && !e.isSymbolicLink() && !['.git', '.claude', '.codex', 'node_modules', 'AppData'].includes(e.name))
          stack.push({ p: path.join(p, e.name), depth: depth + 1 });
      }
    }
  }
  return null;
}

function listWorkspaces() {
  let dirs;
  try { dirs = fs.readdirSync(PROJECTS, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.isSymbolicLink()); }
  catch { return []; }
  return dirs.map((e) => {
    const ws = resolveWorkspace(e.name);
    let state, stateError;
    try { state = ws ? loadState(ws) : null; } catch (error) { stateError = error.message; }
    const prompt = state && state.files.find((f) => f.path === 'CLAUDE.md');
    let deployed = false;
    try { const bytes = prompt && readBytes(path.join(ws, 'CLAUDE.md')); deployed = !!bytes && hash(bytes) === prompt.writtenHash; } catch {}
    return { name: e.name, path: ws || e.name, resolved: !!ws, deployed, subagent: false,
      hasBackup: !!prompt, ...(stateError ? { stateError } : {}) };
  }).sort((a, b) => (Number(b.deployed) - Number(a.deployed)) || a.name.localeCompare(b.name));
}

function detectVersion() {
  return new Promise((resolve) => {
    const win = process.platform === 'win32';
    try {
      execFile(win ? 'cmd' : 'claude', win ? ['/c', 'claude', '--version'] : ['--version'],
        { timeout: 4000, windowsHide: true }, (error, out) => {
          const match = !error && String(out || '').match(/\d+\.\d+\.\d+/);
          resolve(match ? match[0] : null);
        });
    } catch { resolve(null); }
  });
}

async function detect() {
  const ws = listWorkspaces();
  return { ccInstalled: exists(CLAUDE_DIR), ccVersion: (await detectVersion()) || '?',
    settings: exists(SETTINGS_PATH), deployedCount: ws.filter((w) => w.deployed).length,
    subagentCount: 0, memFiles: 0, agentFiles: 0, systemPrompt: false,
    claudeMd: exists(PATHS.CLAUDE_MD), skillDirs: SKILL_DIRS.filter((d) => exists(path.join(SKILL_BUNDLE, d, 'SKILL.md'))).length,
    bundleOk: exists(PATHS.CLAUDE_MD) && exists(path.join(SKILL_BUNDLE, 'sec-forge', 'SKILL.md')) };
}

function resolveTargets(targets) {
  const byName = new Map(listWorkspaces().map((w) => [w.name, w]));
  return (targets || []).map((target) => {
    const key = typeof target === 'string' ? target : target && (target.name || target.path);
    if (byName.has(key)) return byName.get(key);
    const raw = typeof target === 'string' ? target : target && (target.path || target.name);
    if (typeof raw !== 'string' || !raw) throw new Error('INVALID_WORKSPACE_TARGET');
    const absolute = path.isAbsolute(raw);
    return { name: absolute ? projectName(raw) : raw, path: raw,
      resolved: absolute && exists(raw), deployed: false, subagent: false };
  });
}

// Compatibility for older renderers: these inventories are intentionally empty.
function memoryBundleFiles() { return []; }
function agentBundleFiles() { return []; }

module.exports = { PATHS, SKILL_DIRS, exists, projectName, resolveWorkspace, memoryBundleFiles, agentBundleFiles,
  deployWorkspace, uninstallWorkspace, verifyWorkspace, restoreWorkspace, deploySettings, detect, listWorkspaces, resolveTargets };
