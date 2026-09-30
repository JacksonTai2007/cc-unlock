#!/usr/bin/env node
'use strict';

// Offline release assembly only. Never imports app/deployment modules or launches Electron.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const VERSION = '3.0.0';
const LABEL = 'v3.0-stable';
const PE_VERSION = '3.0.0.0';
// Keep NSIS payload paths below Win32 MAX_PATH; the sec-forge bundle has deep task trees.
const BUILD_ROOT = path.join(ROOT, '.b');
const RELEASE = path.join(ROOT, 'release', `cc-unlock-Setup-${LABEL}.exe`);
const TEMPLATE = path.join(ROOT, 'scripts', 'installer', 'cc-unlock-unified.nsi');
const MAKENSIS = process.env.CC_UNLOCK_MAKENSIS ? path.resolve(process.env.CC_UNLOCK_MAKENSIS) : path.join(ROOT, '.build-tools', 'nsis', 'Bin', 'makensis.exe');
const ICON = path.join(ROOT, 'assets', 'cc-unlock.ico');
const CODEX_REQUIRE = require('./build-dependencies.cjs').resolveBuildDependencies(ROOT).require;
const APPS = ['claude', 'codex'];
const APP_FILES = ['main.js', 'preload.js', 'deploy-core.js', 'backup-core.js', 'package.json'];

function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
const hashCache = new Map();
function fileHash(file) {
  const stat = fs.statSync(file);
  const identity = [stat.dev, stat.ino, stat.size, stat.mtimeMs, stat.ctimeMs].join(':');
  const cached = hashCache.get(file);
  if (cached?.identity === identity) return cached.value;
  const value = hash(fs.readFileSync(file));
  hashCache.set(file, { identity, value });
  return value;
}
function relative(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }

function inside(base, candidate) {
  const absolute = path.resolve(candidate);
  const rel = path.relative(base, absolute);
  assert(rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel),
    `Refusing path outside ${base}: ${absolute}`);
  return absolute;
}

function assertNoLinks(candidate) {
  const absolute = inside(ROOT, candidate);
  let current = ROOT;
  for (const segment of path.relative(ROOT, absolute).split(path.sep)) {
    current = path.join(current, segment);
    if (fs.existsSync(current)) assert(!fs.lstatSync(current).isSymbolicLink(), `Link is not allowed: ${current}`);
  }
  return absolute;
}

function inventory(directory) {
  assertNoLinks(directory);
  const result = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(current, entry.name);
      assert(!entry.isSymbolicLink(), `Link is not allowed: ${file}`);
      if (entry.isDirectory()) walk(file);
      else {
        assert(entry.isFile(), `Unsupported filesystem entry: ${file}`);
        result.push({ path: path.relative(directory, file).split(path.sep).join('/'), bytes: fs.statSync(file).size, sha256: fileHash(file) });
      }
    }
  }
  walk(directory);
  return result;
}

function safeWrite(file, content, runDir) {
  inside(runDir, file);
  assertNoLinks(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { flag: 'wx' });
}

function copyFile(source, destination, runDir) {
  assertNoLinks(source);
  inside(runDir, destination);
  assertNoLinks(destination);
  assert(fs.lstatSync(source).isFile(), `Expected source file: ${source}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try { fs.linkSync(source, destination); }
  catch { fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL); }
}

function copyTree(source, destination, runDir) {
  const entries = inventory(source);
  inside(runDir, destination);
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of entries) copyFile(path.join(source, entry.path), path.join(destination, entry.path), runDir);
  assert.deepEqual(inventory(destination), entries, `Copy verification failed: ${source}`);
  return entries;
}

function resourcesFor(app) {
  return [
    ...(app === 'claude' ? [[path.join(ROOT,'cc-unlock-files','claude-config-bundle'),'claude-config-bundle']] :
      [[path.join(ROOT,'codex-files','codex-config-bundle'),'codex-files/codex-config-bundle']]),
    [path.join(ROOT,'cc-unlock-files','skill-bundle'),'skill-bundle'],
  ];
}

function preflight() {
  require('./test-prompt-contract.cjs').validate();
  assert.equal(process.platform, 'win32', 'This release assembler targets the existing Windows x64 runtime.');
  assertNoLinks(BUILD_ROOT);
  assertNoLinks(RELEASE);
  assert(!fs.existsSync(RELEASE), `Release already exists; preserve it or select a new release before rebuilding: ${RELEASE}`);
  assertNoLinks(RELEASE + '.sha256');
  assert(!fs.existsSync(RELEASE + '.sha256'), `Release checksum already exists: ${RELEASE}.sha256`);
  assert(fs.statSync(MAKENSIS).isFile(), `Missing NSIS compiler: ${MAKENSIS}`);
  for (const file of [TEMPLATE, ICON]) {
    assertNoLinks(file);
    assert(fs.statSync(file).isFile(), `Missing build input: ${file}`);
  }
  for (const app of APPS) {
    const appRoot = path.join(ROOT, `cc-unlock-${app}`);
    for (const name of APP_FILES) assert(fs.statSync(assertNoLinks(path.join(appRoot, name))).isFile());
    const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
    assert.equal(pkg.version, VERSION, `Update ${app} package.json to ${VERSION} before packaging.`);
    assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'Runtime dependencies require an explicit packaging allowlist.');
    for (const file of ['renderer/app.js', 'renderer/index.html']) {
      const text = fs.readFileSync(path.join(appRoot, file), 'utf8');
      assert(text.includes(LABEL) && !text.includes('v2.0-stable'), `Update UI version in ${app}/${file}.`);
    }
    const runtime = path.join(appRoot, 'dist', `cc-unlock-${app}-win32-x64`);
    assert(fs.statSync(assertNoLinks(path.join(runtime, `cc-unlock-${app}.exe`))).isFile());
    assert(fs.statSync(assertNoLinks(path.join(runtime, 'resources', 'app.asar'))).isFile());
    inventory(path.join(appRoot, 'renderer'));
    for (const [source] of resourcesFor(app)) inventory(source);
  }
  const promptPaths = [
    path.join(ROOT, 'cc-unlock-files', 'claude-config-bundle', 'CLAUDE.md'),
    path.join(ROOT, 'codex-files', 'codex-config-bundle', 'system-prompt.md'),
    path.join(ROOT, 'codex-files', 'codex-config-bundle', 'AGENTS.md'),
  ];
  const canonicals = ['prompts/claude.md', 'prompts/codex-system.md', 'prompts/codex-agents.md'].map(name => path.join(ROOT, name));
  const hashes = promptPaths.map(fileHash);
  canonicals.forEach((file, index) => assert.equal(hashes[index], fileHash(file), `Prompt carrier differs from ${file}`));
  assert.deepEqual(fs.readdirSync(path.join(ROOT, 'cc-unlock-files', 'skill-bundle')).sort(), ['sec-forge'], 'Bundle must contain only sec-forge.');
  CODEX_REQUIRE.resolve('@electron/asar');
  CODEX_REQUIRE.resolve('@electron/packager/resedit');
  CODEX_REQUIRE.resolve('resedit');
  return { version: VERSION, label: LABEL, root: ROOT, makensis: MAKENSIS, release: RELEASE, promptSha256: { claude: hashes[0], codexSystem: hashes[1], codexAgents: hashes[2] } };
}

function exeResources(file, reseditLib) {
  const exe = reseditLib.NtExecutable.from(fs.readFileSync(file));
  return { exe, resources: reseditLib.NtExecutableResource.from(exe) };
}

async function buildApp(app, runDir, dependencies) {
  // The verified v3.0 portable app is the sole payload source. Rebuilding from old
  // v2.1 staging here would drop the integrated Codex conversation editor.
  const { asar, reseditLib } = dependencies;
  const source = path.join(ROOT, `cc-unlock-${app}`);
  const original = path.join(source, 'dist', `cc-unlock-${app}-win32-x64`);
  const packaged = path.join(runDir, `cc-unlock-${app}-win32-x64`);
  const baseline = inventory(original);
  copyTree(original, packaged, runDir);
  const archive = path.join(packaged, 'resources', 'app.asar');
  if (app === 'codex') {
    for (const name of ['context-host.js','context-worker.js','renderer/chat-host.js','renderer/context-panel.js','renderer/shell-common.js']) {
      assert(dependencies.asar.extractFile(archive, name).length > 0, `Missing app module: ${name}`);
    }
    for (const name of ['editor.css','editor-api.js','editor-view.js','editor-dialog.js','editor-actions.js','editor.js']) {
      assert(fs.statSync(path.join(packaged,'resources','chat-editor',name)).isFile(), `Missing editor asset: ${name}`);
    }
  }
  const exePath = path.join(packaged, `cc-unlock-${app}.exe`);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'PORTABLE_MANIFEST_v3.0.json'), 'utf8'));
  assert.equal(manifest.version, VERSION);
  assert.equal(fileHash(archive), manifest.asarSha256);
  assert.equal(fileHash(exePath), manifest.exeSha256);
  const pkg = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
  assert.equal(pkg.version, VERSION);
  const html = asar.extractFile(archive, 'renderer/index.html').toString('utf8');
  assert(html.includes(LABEL), `Stale UI label in ${app}`);
  if (app === 'codex') {
    assert(html.includes('修改对话'), 'Integrated conversation editor is absent.');
    for (const name of ['app.py','launch.py','editor_core.py','message_edit.py','force_edit.py','writer_lock_cleanup.py','index.html','fixtures.py'])
      assert(fs.statSync(path.join(packaged, 'resources', 'chat-editor', name)).isFile(), `Missing editor payload: ${name}`);
  }
  const allowed = app === 'claude' ? ['app.asar','claude-config-bundle','skill-bundle'] : ['app.asar','chat-editor','codex-files','skill-bundle'];
  assert.deepEqual(fs.readdirSync(path.join(packaged,'resources')).sort(), allowed.sort(), 'Unexpected retired payload in package');
  const skills = fs.readdirSync(path.join(packaged, 'resources', 'skill-bundle')).sort();
  assert.deepEqual(skills, ['sec-forge'], `Unexpected packaged skills in ${app}`);
  if (app === 'claude') {
    assert.equal(fileHash(path.join(packaged, 'resources', 'claude-config-bundle', 'CLAUDE.md')), fileHash(path.join(ROOT, 'prompts', 'claude.md')));
  } else {
    assert.equal(fileHash(path.join(packaged, 'resources', 'codex-files', 'codex-config-bundle', 'system-prompt.md')), fileHash(path.join(ROOT, 'prompts', 'codex-system.md')));
    assert.equal(fileHash(path.join(packaged, 'resources', 'codex-files', 'codex-config-bundle', 'AGENTS.md')), fileHash(path.join(ROOT, 'prompts', 'codex-agents.md')));
  }
  const headerSha256 = hash(asar.getRawHeader(archive).headerString);
  assert.equal(headerSha256, manifest.asarHeaderIntegrity.hash);
  const pe = exeResources(exePath, reseditLib);
  const integrity = pe.resources.entries.filter(entry => entry.type === 'INTEGRITY' && entry.id === 'ELECTRONASAR');
  assert.equal(integrity.length, 1);
  const table = JSON.parse(Buffer.from(integrity[0].bin).toString('utf8'));
  assert.equal(table.length, 1);
  assert.equal(table[0].file.replace(/\\+/g, '/'), 'resources/app.asar');
  assert.equal(table[0].value, headerSha256);
  assert.deepEqual(inventory(original), baseline, `Original portable source changed: ${app}`);
  console.log(`Verified ${app}: v3.0 portable payload, sec-forge only, prompt bytes, editor, ASAR integrity.`);
  return { name: app, directory: packaged, baseline, payloads: { skills }, appAsarSha256: fileHash(archive), appAsarHeaderSha256: headerSha256, executableSha256: fileHash(exePath) };
}

function replaceOne(text, pattern, replacement, label) {
  let count = 0;
  const result = text.replace(pattern, (...args) => { count++; return typeof replacement === 'function' ? replacement(...args) : replacement; });
  assert.equal(count, 1, `Expected one ${label} in the NSIS template; found ${count}.`);
  return result;
}

function nsisPath(file) {
  assert(!/["$\r\n]/.test(file), `Unsupported NSIS path: ${file}`);
  return file.replace(/\//g, '\\');
}

function createNsi(apps, output) {
  let text = fs.readFileSync(TEMPLATE, 'utf8').replace(/^\uFEFF/, '');
  text = replaceOne(text, /^OutFile .*$/m, `OutFile "${nsisPath(output)}"`, 'OutFile');
  text = replaceOne(text, /^BrandingText .*$/m, `BrandingText "cc-unlock ${LABEL}"`, 'BrandingText');
  text = replaceOne(text, /^(\s*WriteRegStr HKCU .* "DisplayVersion") "[^"]*"$/m,
    (_line, prefix) => `${prefix} "${VERSION}"`, 'DisplayVersion');
  for (const app of apps) {
    text = replaceOne(text, new RegExp(`^([ \\t]*)File /r "[^"\\r\\n]*cc-unlock-${app.name}-win32-x64\\\\\\*"$`, 'm'),
      (_line, indent) => `${indent}File /r "${nsisPath(app.directory)}\\*"`, `${app.name} payload source`);
  }
  text = text.replace(/"[^"\r\n]*[\\/]assets[\\/]cc-unlock\.ico"/g, `"${nsisPath(ICON)}"`);
  assert(!/^VIProductVersion /m.test(text), 'Review existing NSIS version metadata before replacing it.');
  const metadata = [
    `VIProductVersion "${PE_VERSION}"`,
    `VIAddVersionKey /LANG=1033 "ProductName" "cc-unlock"`,
    `VIAddVersionKey /LANG=1033 "ProductVersion" "${VERSION}"`,
    `VIAddVersionKey /LANG=1033 "FileVersion" "${PE_VERSION}"`,
    `VIAddVersionKey /LANG=1033 "FileDescription" "cc-unlock ${LABEL} unified installer"`,
    `VIAddVersionKey /LANG=1033 "LegalCopyright" "JacksonTai"`,
  ].join('\r\n');
  text = replaceOne(text, /^Unicode true$/m, `Unicode true\r\n${metadata}`, 'Unicode declaration');
  assert(!text.includes('v2.0-stable'), 'Stale version label in generated installer script.');
  return '\uFEFF' + text;
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.length === 0 || (args.length === 1 && args[0] === '--preflight'), 'Usage: node scripts/build-installer.cjs [--preflight]');
  if (args.length === 0) require('./sync-prompts.cjs').sync('--write', { quiet: true });
  const preflightResult = preflight();
  if (args[0] === '--preflight') {
    console.log(JSON.stringify({ ...preflightResult, status: 'preflight passed; no files written or executables launched' }, null, 2));
    return;
  }
  fs.mkdirSync(BUILD_ROOT, { recursive: true });
  const runDir = fs.mkdtempSync(path.join(BUILD_ROOT, 'build-'));
  inside(BUILD_ROOT, runDir);
  const dependencies = { asar: CODEX_REQUIRE('@electron/asar'), resedit: CODEX_REQUIRE('@electron/packager/resedit').resedit, reseditLib: CODEX_REQUIRE('resedit') };
  const apps = [];
  for (const app of APPS) apps.push(await buildApp(app, runDir, dependencies));
  const temporaryOutput = path.join(runDir, `cc-unlock-Setup-${LABEL}.exe`);
  const nsi = path.join(runDir, `cc-unlock-unified-${LABEL}.nsi`);
  safeWrite(nsi, createNsi(apps, temporaryOutput), runDir);
  console.log(`Compiling with local NSIS: ${MAKENSIS}`);
  const result = spawnSync(MAKENSIS, ['-V3', nsi], { cwd: path.dirname(MAKENSIS), shell: false, windowsHide: true, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  safeWrite(path.join(runDir, 'makensis.log'), `${result.stdout || ''}\n${result.stderr || ''}`, runDir);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `NSIS failed; review ${path.join(runDir, 'makensis.log')}`);
  const installer = fs.readFileSync(temporaryOutput);
  assert(installer.length > 1024 * 1024 && installer.toString('ascii', 0, 2) === 'MZ', 'NSIS did not produce a plausible Windows installer.');
  const finalPe = exeResources(temporaryOutput, dependencies.reseditLib);
  const finalVersions = dependencies.reseditLib.Resource.VersionInfo.fromEntries(finalPe.resources.entries);
  assert.equal(finalVersions.length, 1);
  const finalStrings = finalVersions[0].getStringValues({ lang: 1033, codepage: 1200 });
  assert.equal(finalStrings.ProductVersion, VERSION);
  assert.equal(finalStrings.FileVersion, PE_VERSION);
  // Recheck the original runtime after the compiler has consumed only the staged app trees.
  for (const app of apps) assert.deepEqual(inventory(path.join(ROOT, `cc-unlock-${app.name}`, 'dist', `cc-unlock-${app.name}-win32-x64`)), app.baseline);
  assertNoLinks(RELEASE);
  fs.mkdirSync(path.dirname(RELEASE), { recursive: true });
  fs.copyFileSync(temporaryOutput, RELEASE, fs.constants.COPYFILE_EXCL);
  const installerChecksum = hash(installer);
  assert.equal(fileHash(RELEASE), installerChecksum);
  const report = { ...preflightResult, builtAt: new Date().toISOString(), runDirectory: runDir, installer: { path: RELEASE, bytes: installer.length, sha256: installerChecksum }, apps, verification: { sourceDistUnchanged: true, appAsarByteChecks: true, resourceManifestChecks: true, peVersionChecks: true, asarIntegrityChecks: true, deploymentExecuted: false, installerExecuted: false } };
  safeWrite(path.join(runDir, 'build-report.json'), JSON.stringify(report, null, 2) + '\n', runDir);
  const shaFile = RELEASE + '.sha256';
  assertNoLinks(shaFile);
  fs.writeFileSync(shaFile, `${installerChecksum}  ${path.basename(RELEASE)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ status: 'built and statically verified; installer NOT executed', installer: RELEASE, sha256: installerChecksum, report: path.join(runDir, 'build-report.json'), source: relative(TEMPLATE) }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
module.exports = { preflight, createNsi, inside, resourcesFor, VERSION, LABEL };
