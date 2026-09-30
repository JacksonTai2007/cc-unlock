#!/usr/bin/env node
'use strict';

// Real filesystem integration tests with a VM-injected disposable HOME/resources.
// The allowlist prevents this smoke test from deploying to the actual account.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-unlock-claude-minimal-'));
const home = path.join(root, 'home');
const mono = path.join(root, 'app');
const app = path.join(mono, 'cc-unlock-claude');
const bundle = path.join(mono, 'cc-unlock-files');
const source = fs.readFileSync(path.resolve(__dirname, '../cc-unlock-claude/deploy-core.js'), 'utf8');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const journal = [];
const results = [];
const logs = [];
let phase = 'setup';
let failNextWrite;

function inside(base, file) {
  const rel = path.relative(base, file);
  return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep));
}
function checked(file, mutate = false) {
  assert.equal(typeof file, 'string', 'only explicit paths permitted');
  const full = path.resolve(file);
  if (!inside(root, full) && !(mutate === false && inside(full, root)))
    throw new Error(`ISOLATION_BLOCKED: ${full}`);
  if (mutate && full === root) throw new Error('ISOLATION_BLOCKED: fixture root mutation');
  return full;
}
function write(file, bytes) {
  checked(file, true); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes);
}
function mkdir(dir) { checked(dir, true); fs.mkdirSync(dir, { recursive: true }); return dir; }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function snapshot(dir) {
  const out = {};
  if (!fs.existsSync(dir)) return out;
  function walk(p) {
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, entry.name);
      if (entry.isSymbolicLink()) out[path.relative(dir, full)] = 'LINK';
      else if (entry.isDirectory()) walk(full);
      else out[path.relative(dir, full)] = hash(fs.readFileSync(full));
    }
  }
  walk(dir); return out;
}
const guarded = {};
for (const name of ['existsSync', 'readFileSync', 'readdirSync', 'lstatSync']) {
  guarded[name] = (file, ...args) => fs[name](checked(file), ...args);
}
for (const name of ['mkdirSync', 'writeFileSync', 'rmSync']) {
  guarded[name] = (file, ...args) => {
    const full = checked(file, true);
    if (name === 'rmSync' && args[0] && args[0].recursive) throw new Error('RECURSIVE_DELETE_NOT_ALLOWED');
    journal.push({ phase, operation: name, path: full });
    if (name === 'writeFileSync' && failNextWrite && full === failNextWrite) {
      failNextWrite = null; throw new Error('INJECTED_WRITE_FAILURE');
    }
    return fs[name](full, ...args);
  };
}
function load(resourcesPath, development = false) {
  const module = { exports: {} };
  const ctx = {
    module, exports: module.exports, __dirname: resourcesPath && !development ? path.join(resourcesPath, 'app.asar') : app, Buffer, console,
    process: { platform: process.platform, ...(resourcesPath ? { resourcesPath } : {}) },
    require(name) {
      if (name === 'fs') return new Proxy(guarded, { get(target, key) {
        if (!(key in target)) throw new Error(`FS_API_BLOCKED: ${String(key)}`);
        return target[key];
      } });
      if (name === 'os') return { homedir: () => home };
      if (name === 'path') return path;
      if (name === 'crypto') return crypto;
      if (name === 'child_process') return { execFile(bin, args, opts, callback) {
        assert.equal(opts.windowsHide, true);
        callback(null, '2.1.280 (test fixture)');
      } };
      throw new Error(`REQUIRE_BLOCKED: ${name}`);
    },
  };
  vm.runInNewContext(source, ctx, { filename: 'deploy-core.js' });
  return module.exports;
}
function check(name, action) {
  phase = name;
  action();
  results.push({ name, status: 'PASS' });
  console.log(`PASS ${name}`);
}
const log = (kind, message) => logs.push({ phase, kind, message });
const promptBytes = Buffer.from('# Reverse engineering workspace\n\nEvidence before claims.\n');
const skillRel = ['SKILL.md', 'android-reverse/SKILL.md', 'web-reverse/SKILL.md', 'win-reverse/SKILL.md', 'references/methods.md'];
function seedBundles(where) {
  write(path.join(where, 'claude-config-bundle', 'CLAUDE.md'), promptBytes);
  for (const rel of skillRel) write(path.join(where, 'skill-bundle', 'sec-forge', ...rel.split('/')), `# Fixture ${rel}\n`);
  write(path.join(where, 'memory-bundle', 'MEMORY.md'), 'DO NOT DEPLOY MEMORY');
  write(path.join(where, 'config-bundle', 'settings.json'), '{"env":{"FORBIDDEN":"1"}}');
}
function stateFile(ws) { return path.join(ws, '.claude', '.cc-unlock-state', 'claude-minimal-v1.json'); }
function skillFile(ws, rel = 'SKILL.md') { return path.join(ws, '.claude', 'skills', 'sec-forge', ...rel.split('/')); }

(async () => {
  mkdir(home); mkdir(app);
  const core = load();
  const ws = mkdir(path.join(home, 'Desktop', 'project-with spaces'));
  check('missing bundle fails before any workspace write', () => {
    const before = snapshot(ws);
    assert.throws(() => core.deployWorkspace(ws, {}, log), /MISSING_CLAUDE_BUNDLE/);
    assert.deepEqual(snapshot(ws), before);
  });
  seedBundles(bundle);
  const original = Buffer.from('# User original\r\nDo not lose these bytes.\r\n');
  write(path.join(ws, 'CLAUDE.md'), original);
  const project = path.join(home, '.claude', 'projects', core.projectName(ws));
  const protectedPaths = [
    path.join(project, 'memory', 'MEMORY.md'), path.join(project, 'memory', 'personal.md'),
    path.join(home, '.claude', 'settings.json'), path.join(home, '.claude', 'CLAUDE.md'),
    path.join(ws, '.claude', 'agents', 'researcher.md'), path.join(ws, '.claude', 'rules', 'research-workflow.md'),
    path.join(ws, '.claude', 'agent-memory', 'researcher', 'MEMORY.md'),
    path.join(ws, '.claude', 'skills', 'unrelated', 'SKILL.md'),
    path.join(ws, '.claude', '.cc-unlock-state', 'manifest.json'),
  ];
  for (const file of protectedPaths) write(file, `PERSONAL DATA: ${path.basename(file)}\n`);
  const protectedHashes = protectedPaths.map((file) => hash(fs.readFileSync(file)));
  const envBefore = JSON.stringify(process.env);
  check('deploy writes only CLAUDE.md and sec-forge plus ownership state', () => {
    const start = journal.length;
    const result = core.deployWorkspace(ws, { subagent: true }, log);
    assert.equal(result.ok, true); assert.equal(result.skillFiles, skillRel.length);
    assert.deepEqual(fs.readFileSync(path.join(ws, 'CLAUDE.md')), promptBytes);
    assert.equal(core.verifyWorkspace(ws, log).ok, true);
    const writes = journal.slice(start).filter((e) => e.operation === 'writeFileSync');
    assert.equal(writes.length, skillRel.length + 2);
    for (const entry of writes) assert.ok(entry.path === path.join(ws, 'CLAUDE.md') ||
      inside(path.join(ws, '.claude', 'skills', 'sec-forge'), entry.path) || entry.path === stateFile(ws));
  });
  check('memory agents rules global settings environment and legacy state are unchanged', () => {
    assert.deepEqual(protectedPaths.map((file) => hash(fs.readFileSync(file))), protectedHashes);
    assert.equal(JSON.stringify(process.env), envBefore);
    assert.equal(core.memoryBundleFiles().length, 0); assert.equal(core.agentBundleFiles().length, 0);
  });
  check('repeat deployment is content-idempotent and preserves original bytes', () => {
    const result = core.deployWorkspace(ws, {}, log);
    assert.equal(result.changed, 0);
    const record = JSON.parse(read(stateFile(ws))).files.find((f) => f.path === 'CLAUDE.md');
    assert.deepEqual(Buffer.from(record.originalBase64, 'base64'), original);
  });
  check('verification and settings compatibility API make no writes', () => {
    const start = journal.length;
    assert.equal(core.verifyWorkspace(ws).ok, true);
    assert.equal(core.deploySettings(log).skipped, true);
    assert.equal(journal.length, start);
  });
  check('workspace mapping resolves names with spaces and hyphens', () => {
    const listed = core.listWorkspaces().find((item) => item.name === core.projectName(ws));
    assert.equal(listed.path, ws); assert.equal(listed.deployed, true); assert.equal(listed.subagent, false);
    assert.equal(core.resolveTargets([listed.name])[0].path, ws);
    assert.equal(core.resolveTargets([ws])[0].path, ws);
  });
  const detection = await core.detect();
  check('detection advertises native CLAUDE.md with zero memory or agent deployment', () => {
    assert.equal(detection.ccVersion, '2.1.280'); assert.equal(detection.bundleOk, true);
    assert.equal(detection.claudeMd, true); assert.equal(detection.systemPrompt, false);
    assert.equal(detection.agentFiles + detection.memFiles + detection.subagentCount, 0);
  });
  check('restore targets only current owned prompt and ignores legacy manifest', () => {
    const result = core.restoreWorkspace(ws, log);
    assert.equal(result.ok, true); assert.equal(result.results.length, 1);
    assert.deepEqual(fs.readFileSync(path.join(ws, 'CLAUDE.md')), original);
    assert.equal(fs.existsSync(skillFile(ws)), true);
    assert.deepEqual(protectedPaths.map((file) => hash(fs.readFileSync(file))), protectedHashes);
  });
  check('uninstall removes owned skill files and preserves restored prompt and unrelated files', () => {
    assert.equal(core.uninstallWorkspace(ws, log).ok, true);
    assert.equal(fs.existsSync(skillFile(ws)), false);
    assert.deepEqual(fs.readFileSync(path.join(ws, 'CLAUDE.md')), original);
    assert.deepEqual(protectedPaths.map((file) => hash(fs.readFileSync(file))), protectedHashes);
  });
  const absent = mkdir(path.join(home, 'Desktop', 'initially-absent'));
  check('uninstall removes an originally absent prompt', () => {
    core.deployWorkspace(absent, {}, log);
    assert.equal(core.uninstallWorkspace(absent, log).ok, true);
    assert.equal(fs.existsSync(path.join(absent, 'CLAUDE.md')), false);
  });
  const edited = mkdir(path.join(home, 'Desktop', 'user-edited'));
  core.deployWorkspace(edited, {}, log);
  write(path.join(edited, 'CLAUDE.md'), '# User edit\n');
  write(skillFile(edited), '# User skill edit\n');
  check('redeploy refuses edited owned files before any write', () => {
    const before = snapshot(edited); const start = journal.length;
    assert.throws(() => core.deployWorkspace(edited, {}, log), /USER_MODIFIED_FILE/);
    assert.deepEqual(snapshot(edited), before); assert.equal(journal.length, start);
    assert.equal(core.verifyWorkspace(edited).ok, false);
  });
  check('restore and uninstall preserve edited prompt and skill while reporting skips', () => {
    assert.equal(core.restoreWorkspace(edited, log).ok, false);
    const result = core.uninstallWorkspace(edited, log);
    assert.equal(result.ok, false); assert.equal(result.skipped.length, 2);
    assert.equal(read(path.join(edited, 'CLAUDE.md')), '# User edit\n');
    assert.equal(read(skillFile(edited)), '# User skill edit\n');
    assert.equal(fs.existsSync(skillFile(edited, 'references/methods.md')), false);
  });
  const conflict = mkdir(path.join(home, 'Desktop', 'existing-skill'));
  write(path.join(conflict, 'CLAUDE.md'), original); write(skillFile(conflict), '# Existing independent skill\n');
  check('pre-existing different skill fails before overwriting existing prompt', () => {
    const before = snapshot(conflict);
    assert.throws(() => core.deployWorkspace(conflict, {}, log), /EXISTING_SKILL_CONFLICT/);
    assert.deepEqual(snapshot(conflict), before);
  });
  const equal = mkdir(path.join(home, 'Desktop', 'identical-skill'));
  const existingSkill = fs.readFileSync(path.join(bundle, 'skill-bundle', 'sec-forge', 'SKILL.md'));
  write(skillFile(equal), existingSkill);
  check('identical pre-existing skill survives uninstall', () => {
    core.deployWorkspace(equal, {}, log); core.uninstallWorkspace(equal, log);
    assert.deepEqual(fs.readFileSync(skillFile(equal)), existingSkill);
  });
  const corrupt = mkdir(path.join(home, 'Desktop', 'corrupt-state'));
  write(stateFile(corrupt), JSON.stringify({ version: 1, workspace: corrupt, files: [{
    path: '../outside.txt', existed: false, writtenHash: '0'.repeat(64),
  }] }));
  check('path traversal in ownership state is rejected before writes', () => {
    const before = snapshot(corrupt);
    assert.throws(() => core.deployWorkspace(corrupt, {}, log), /INVALID_OWNERSHIP_STATE/);
    assert.throws(() => core.restoreWorkspace(corrupt, log), /INVALID_OWNERSHIP_STATE/);
    assert.deepEqual(snapshot(corrupt), before);
  });
  const failing = mkdir(path.join(home, 'Desktop', 'write-failure'));
  write(path.join(failing, 'CLAUDE.md'), original);
  check('write failure rolls back applied prompt and skill bytes', () => {
    failNextWrite = skillFile(failing, 'references/methods.md');
    assert.throws(() => core.deployWorkspace(failing, {}, log), /INJECTED_WRITE_FAILURE.*writes rolled back/);
    assert.deepEqual(fs.readFileSync(path.join(failing, 'CLAUDE.md')), original);
    assert.equal(fs.existsSync(skillFile(failing)), false);
    assert.equal(fs.existsSync(stateFile(failing)), false);
  });
  const missingResources = mkdir(path.join(root, 'resources-missing'));
  check('Electron development resourcesPath still resolves source bundles', () => {
    const development = load(missingResources, true);
    assert.equal(development.PATHS.CONFIG_BUNDLE, path.join(bundle, 'claude-config-bundle'));
    assert.equal(development.PATHS.SKILL_BUNDLE, path.join(bundle, 'skill-bundle'));
  });
  check('packaged missing bundle does not silently fall back to development bundle', () => {
    const packaged = load(missingResources);
    assert.throws(() => packaged.deployWorkspace(failing, {}, log), /MISSING_CLAUDE_BUNDLE/);
  });
  const resources = mkdir(path.join(root, 'resources'));
  seedBundles(resources);
  const packagedWorkspace = mkdir(path.join(home, 'Desktop', 'packaged'));
  check('packaged resource paths deploy and verify', () => {
    const packaged = load(resources);
    assert.equal(packaged.PATHS.CONFIG_BUNDLE, path.join(resources, 'claude-config-bundle'));
    packaged.deployWorkspace(packagedWorkspace, {}, log);
    assert.equal(packaged.verifyWorkspace(packagedWorkspace).ok, true);
  });
  const linked = mkdir(path.join(home, 'Desktop', 'junction-workspace'));
  const external = mkdir(path.join(root, 'external'));
  const link = path.join(linked, '.claude');
  fs.symlinkSync(external, link, process.platform === 'win32' ? 'junction' : 'dir');
  check('junction destination is rejected without writing through it', () => {
    const before = snapshot(external);
    assert.throws(() => core.deployWorkspace(linked, {}, log), /SYMLINK_OR_JUNCTION/);
    assert.deepEqual(snapshot(external), before);
    assert.equal(fs.existsSync(path.join(linked, 'CLAUDE.md')), false);
  });
  const legacy = mkdir(path.join(home, 'Desktop', 'legacy-only'));
  write(path.join(legacy, '.claude', '.cc-unlock-state', 'manifest.json'), '{"memory":"legacy"}');
  check('legacy-only restore is a no-op rather than restoreAll', () => {
    const before = snapshot(legacy); const start = journal.length;
    assert.equal(core.restoreWorkspace(legacy, log).noState, true);
    assert.deepEqual(snapshot(legacy), before); assert.equal(journal.length, start);
  });
  check('all protected user files still match after every operation', () => {
    assert.deepEqual(protectedPaths.map((file) => hash(fs.readFileSync(file))), protectedHashes);
    assert.equal(JSON.stringify(process.env), envBefore);
  });
  const reportPath = path.join(root, 'report.json');
  write(reportPath, JSON.stringify({ kind: 'isolated-claude-minimal-deployment', root, tests: results,
    logs, journal, realHomeModified: false, modelExecution: 'NOT_RUN' }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, passed: results.length, reportPath }));
})().catch((error) => {
  console.error(error.stack || error);
  console.error(`FAILED phase=${phase} fixture=${root}`);
  process.exitCode = 1;
});
