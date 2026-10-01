#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const corePath = path.resolve(__dirname, '../cc-unlock-codex/lock-delete-state.js');
const source = fs.readFileSync(corePath, 'utf8');
const HOME = path.resolve(os.tmpdir(), 'cc-unlock-native-probe-fixture-home');
const ROOT = path.join(HOME, '.codex', 'thread-writer-locks');
function fixture(opts = {}) {
  const calls = [], filesystem = [];
  const fakefs = {
    lstatSync(file) {
      filesystem.push({ method: 'lstat', file });
      if (opts.failParentStat) throw Object.assign(new Error('fixture parent unavailable'), { code: 'EACCES' });
      return { isSymbolicLink: () => opts.linkParent === file, isDirectory: () => true };
    },
    realpathSync(file) { filesystem.push({ method: 'realpath', file }); return opts.redirectParent === file ? path.join(HOME, 'outside') : file; },
  };
  const run = (exe, args, execOpts) => {
    calls.push({ exe, args, opts: execOpts });
    if (opts.execError) throw opts.execError;
    if (opts.output !== undefined) return opts.output;
    const files = JSON.parse(execOpts.input);
    return JSON.stringify(files.map(file => ({ file, ntstatus: opts.statuses && opts.statuses[path.basename(file)] || '0x00000000' })));
  };
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, Buffer,
    process: { platform: opts.platform || 'win32', env: { SystemRoot: opts.noSystemRoot ? undefined : 'C:\\Windows' } },
    require: id => {
      if (id === 'fs') return fakefs;
      if (id === 'os') return { homedir: () => HOME };
      if (id === 'path') return path;
      if (id === 'child_process') return { execFileSync: run };
      throw new Error('Unexpected require ' + id);
    },
  }, { filename: corePath });
  return { probe: module.exports.probeLockDeleteState, calls, filesystem };
}
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function file(name = 'fixture.lock') { return path.join(ROOT, name); }
test('native exact statuses are distinct, including genuine permissions and sharing errors', () => {
  const statuses = { 'pending.lock': '0xc0000056', 'denied.lock': '0xc0000022', 'busy.lock': '0xc0000043',
    'missing.lock': '0xc0000034', 'pathmissing.lock': '0xc000003a', 'ok.lock': '0x00000000', 'other.lock': '0xc0000106' };
  const f = fixture({ statuses }), r = f.probe(Object.keys(statuses).map(file));
  assert.equal(r.failures.length, 0); assert.equal(r.results.length, 7);
  assert.deepEqual(Array.from(r.results, item => item.status), ['delete-pending', 'access-denied', 'sharing-violation', 'not-found', 'not-found', 'accessible', 'other']);
});
test('constant native command has bounded hidden process and JSON-only Unicode filename input', () => {
  const f = fixture(), name = file("测试';$(exit 1);.lock"), r = f.probe([name], { root: ROOT }); assert.equal(r.failures.length, 0);
  const call = f.calls[0]; assert.equal(call.exe, 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.deepEqual(Array.from(call.args.slice(0, 4)), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command']);
  assert(!call.args[4].includes(name)); assert(call.args[4].includes('NtOpenFile')); assert(call.args[4].includes('NtClose'));
  assert(!/DeleteFile|File\.Delete|TerminateProcess|OpenProcess/.test(call.args[4]));
  assert.equal(call.opts.input, JSON.stringify([name])); assert.equal(call.opts.encoding, 'utf8'); assert.equal(call.opts.windowsHide, true);
  assert.equal(call.opts.timeout, 12000); assert.equal(call.opts.maxBuffer, 1024 * 1024);
  assert(!f.filesystem.some(item => item.method === 'lstat' && item.file === name));
});
test('empty request returns without probing or touching any directory', () => {
  const f = fixture(), r = f.probe([]); assert.equal(r.results.length, 0); assert.equal(r.failures.length, 0); assert.equal(f.calls.length, 0); assert.equal(f.filesystem.length, 0);
});
test('case-duplicate explicit files are probed only once', () => {
  const f = fixture(), r = f.probe([file('sample.lock'), file('SAMPLE.LOCK')]); assert.equal(r.failures.length, 0); assert.equal(r.results.length, 1);
  assert.equal(JSON.parse(f.calls[0].opts.input).length, 1);
});
test('Unix reports unsupported and never starts a Windows helper', () => {
  const f = fixture({ platform: 'linux' }), r = f.probe([file()]); assert.equal(r.supported, false); assert.equal(r.failures[0].code, 'ENOTSUP'); assert.equal(f.calls.length, 0);
});
test('non-user root is rejected before any filesystem or process action', () => {
  const f = fixture(), r = f.probe([file()], { root: path.join(HOME, 'outside') }); assert.equal(r.failures[0].code, 'CC_LOCK_SCOPE'); assert.equal(f.filesystem.length, 0); assert.equal(f.calls.length, 0);
});
test('outside files, root itself and sibling-prefix files are rejected without a process', () => {
  for (const candidate of [ROOT, path.join(HOME, 'outside.lock'), ROOT + '-outside\\file.lock']) {
    const f = fixture(), r = f.probe([candidate]); assert.equal(r.results.length, 0); assert.equal(r.failures[0].code, 'CC_LOCK_SCOPE'); assert.equal(f.calls.length, 0);
  }
});
test('invalid or oversized request is rejected, never batch-expanded', () => {
  for (const value of [null, 'file.lock', Array(513).fill(file()), [null], [''], [file('invalid\0.lock')], [file('x'.repeat(33000))]]) {
    const f = fixture(), r = f.probe(value); assert.equal(r.results.length, 0); assert.equal(r.failures[0].code, 'CC_LOCK_INPUT'); assert.equal(f.calls.length, 0);
  }
});
test('linked lock parent is rejected without following its target', () => {
  const parent = path.join(ROOT, 'nested'), f = fixture({ linkParent: parent }), r = f.probe([path.join(parent, 'file.lock')]);
  assert.equal(r.failures[0].code, 'CC_LOCK_SCOPE'); assert.equal(f.calls.length, 0);
});
test('realpath parent outside lock root is rejected', () => {
  const parent = path.join(ROOT, 'nested'), f = fixture({ redirectParent: parent }), r = f.probe([path.join(parent, 'file.lock')]);
  assert.equal(r.failures[0].code, 'CC_LOCK_SCOPE'); assert.equal(f.calls.length, 0);
});
test('missing SystemRoot reports unavailable rather than guessing an executable', () => {
  const f = fixture({ noSystemRoot: true }), r = f.probe([file()]); assert.equal(r.failures[0].code, 'CC_LOCK_PROBE_UNAVAILABLE'); assert.equal(f.calls.length, 0);
});
test('failed parent validation does not run or classify a native result', () => {
  const f = fixture({ failParentStat: true }), r = f.probe([file()]); assert.equal(r.failures[0].stage, 'validate-input'); assert.equal(r.failures[0].code, 'EACCES'); assert.equal(f.calls.length, 0);
});
test('process denial and timeout remain unavailable, not delete-pending', () => {
  for (const code of ['EACCES', 'ETIMEDOUT']) {
    const f = fixture({ execError: Object.assign(new Error('fixture ' + code), { code }) }), r = f.probe([file()]);
    assert.equal(r.results.length, 0); assert.equal(r.failures[0].stage, 'native-probe'); assert.equal(r.failures[0].code, code);
  }
});
test('JSON noise, malformed status, unexpected path and incomplete output never infer pending', () => {
  const valid = { file: file(), ntstatus: '0xc0000056' };
  for (const output of ['not JSON', '{}', '[]', JSON.stringify([{ ...valid, ntstatus: 'EPERM' }]),
    JSON.stringify([{ ...valid, file: path.join(HOME, 'outside.lock') }]), JSON.stringify([valid, valid])]) {
    const f = fixture({ output }), r = f.probe([file()]); assert.equal(r.results.length, 0); assert.equal(r.failures[0].stage, 'parse-native-result');
  }
});
test('invalid later native record discards earlier pending record atomically', () => {
  const f = fixture({ output: JSON.stringify([{ file: file('one.lock'), ntstatus: '0xc0000056' }, { file: file('one.lock'), ntstatus: '0x00000000' }]) });
  const r = f.probe([file('one.lock'), file('two.lock')]); assert.equal(r.results.length, 0); assert.equal(r.failures[0].stage, 'parse-native-result');
});
test('UTF8 BOM and uppercase hex normalize without losing exact status', () => {
  const f = fixture({ output: '\uFEFF' + JSON.stringify([{ file: file(), ntstatus: '0xC0000056' }]) }), r = f.probe([file()]);
  assert.equal(r.failures.length, 0); assert.equal(r.results[0].ntstatus, '0xc0000056'); assert.equal(r.results[0].status, 'delete-pending');
});
if (process.argv.includes('--native')) {
  test('actual native read-only probe preserves disposable ordinary file, distinguishes missing path', () => {
    assert.equal(process.platform, 'win32');
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-unlock-native-status-'));
    const home = path.join(sandbox, '测试-home'), root = path.join(home, '.codex', 'thread-writer-locks'), name = path.join(root, "普通';$(exit 1).lock"), absent = path.join(root, 'missing.lock');
    fs.mkdirSync(root, { recursive: true }); fs.writeFileSync(name, 'unchanged read-only fixture');
    const module = { exports: {} };
    vm.runInNewContext(source, { module, exports: module.exports, Buffer, process,
      require: id => id === 'os' ? { homedir: () => home } : require(id),
    }, { filename: corePath });
    const r = module.exports.probeLockDeleteState([name, absent], { root });
    assert.equal(r.failures.length, 0, JSON.stringify(r)); assert.equal(r.results[0].status, 'accessible'); assert.equal(r.results[1].status, 'not-found');
    assert.equal(fs.readFileSync(name, 'utf8'), 'unchanged read-only fixture'); assert(!fs.existsSync(absent));
  });
}
console.log(`RESULT ${count}/${count} PASS; explicit paths; no live deletion`);
