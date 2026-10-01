#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createMaintenanceJournal, summarizeResult } = require('../cc-unlock-codex/maintenance-log');

const requestedWork = process.argv.indexOf('--work');
const work = requestedWork >= 0 ? path.resolve(process.argv[requestedWork + 1]) : os.tmpdir();
fs.mkdirSync(work, { recursive: true });
const root = fs.mkdtempSync(path.join(work, 'ccunlock-maintenance-log-'));
let passed = 0;
async function test(name, body) {
  try { await body(); passed++; process.stdout.write(`PASS ${name}\n`); }
  catch (error) { process.stderr.write(`FAIL ${name}: ${error.stack}\n`); process.exitCode = 1; }
}
function area(name) { const dir = path.join(root, name); fs.mkdirSync(dir, { recursive: true }); return dir; }
function entries(file) { return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); }
function filesystemFailure(method, code = 'EACCES') {
  return new Proxy(fs, { get(target, key) {
    if (key === method) return () => { throw Object.assign(Error(`synthetic ${method} denial`), { code }); };
    return target[key];
  } });
}

async function main() {
  await test('dynamic user directory / UTF-8 begin, progress, result', () => {
    const userDataPath = area('另一个用户');
    const journal = createMaintenanceJournal({ userDataPath, action: 'context-clean', clock: () => new Date('2026-01-01T00:00:00.000Z') });
    journal.progress('fail', '合成失败 C:\\Users\\测试用户\\.codex\\thread-writer-locks\\case.lock: [unlink/EACCES] denial');
    const output = journal.finish({ ok: false, filesScanned: 633, recordsNeutralized: 0, failures: [{ file: 'case.lock', stage: 'unlink', code: 'EACCES', error: '合成权限拒绝' }] });
    assert.equal(output.logFile, path.join(userDataPath, 'logs', 'context-clean-latest.jsonl'));
    assert.equal(output.logFailure, undefined);
    const rows = entries(output.logFile);
    assert.deepEqual(rows.map(row => row.type), ['begin', 'progress', 'result']);
    assert(rows.every(row => row.action === 'context-clean' && row.timestamp === '2026-01-01T00:00:00.000Z'));
    assert(rows[1].text.includes('测试用户'));
    assert.equal(rows[2].summary.filesScanned, 633);
    assert.equal(rows[2].summary.failures[0].code, 'EACCES');
  });
  await test('overwrite latest only and keep scan / clean separated', () => {
    const userDataPath = area('latest');
    let journal = createMaintenanceJournal({ userDataPath, action: 'context-clean' });
    const old = journal.finish({ ok: false, error: 'OLD_RESULT' }).logFile;
    journal = createMaintenanceJournal({ userDataPath, action: 'context-clean' });
    journal.finish({ ok: true, status: 'no-match' });
    const scan = createMaintenanceJournal({ userDataPath, action: 'context-scan' });
    scan.finish({ ok: true, filesScanned: 123 });
    assert.equal(entries(old).length, 2);
    assert(!fs.readFileSync(old, 'utf8').includes('OLD_RESULT'));
    assert.deepEqual(fs.readdirSync(path.dirname(old)).sort(), ['context-clean-latest.jsonl', 'context-scan-latest.jsonl']);
  });
  await test('result excludes prompt snapshots, message records and inventories', () => {
    const summary = summarizeResult({ ok: false, filesScanned: 2,
      files: [{ file: 'SECRET_INVENTORY', matches: [{ message: 'PRIVATE_CONVERSATION' }] }],
      systemPrompt: 'PRIVATE_SYSTEM_PROMPT', records: ['PRIVATE_RECORD'],
      skippedChangedDuringScan: ['concurrent-case.jsonl'],
      failures: [{ file: 'failed.lock', stage: 'unlink', code: 'EPERM', error: 'actual error', content: 'PRIVATE_RECORD', matches: ['PRIVATE_CONVERSATION'] }],
      threadWriterLocks: { removed: ['SECRET_INVENTORY'], failures: [], pendingDeletion: [{ file: 'pending.lock', ntstatus: 'STATUS_DELETE_PENDING' }] },
    });
    const text = JSON.stringify(summary);
    assert(!/SECRET_INVENTORY|PRIVATE_CONVERSATION|PRIVATE_SYSTEM_PROMPT|PRIVATE_RECORD/.test(text));
    assert.equal(summary.threadWriterLocks.removedCount, 1);
    assert.equal(summary.threadWriterLocks.pendingDeletionCount, 1);
    assert.equal(summary.failures[0].error, 'actual error');
    assert.deepEqual(summary.concurrentConflicts, [{ file: 'concurrent-case.jsonl' }]);
  });
  await test('redact bearer and query credentials', () => {
    const journal = createMaintenanceJournal({ userDataPath: area('redacted'), action: 'context-scan' });
    journal.progress('fail', 'Bearer SYNTHETIC_TOKEN https://example.test/?api_key=SYNTHETIC_KEY&token=SYNTHETIC_TOKEN2 password=SYNTHETIC_PASS');
    const output = journal.finish({ ok: false, error: 'secret=SYNTHETIC_SECRET' });
    assert(!fs.readFileSync(output.logFile, 'utf8').includes('SYNTHETIC_'));
    assert(fs.readFileSync(output.logFile, 'utf8').includes('[REDACTED]'));
  });
  await test('log directory create denial returns genuine stage / code without file claim', () => {
    const journal = createMaintenanceJournal({ userDataPath: area('create-denied'), action: 'context-clean', fs: filesystemFailure('mkdirSync') });
    const output = journal.finish({ ok: false, failures: [{ code: 'EPERM' }] });
    assert.equal(output.logFile, undefined);
    assert.equal(output.logFailure.code, 'EACCES');
    assert.equal(output.logFailure.stage, 'begin');
  });
  await test('write denial does not claim saved journal', () => {
    const journal = createMaintenanceJournal({ userDataPath: area('write-denied'), action: 'context-clean', fs: filesystemFailure('writeSync', 'EIO') });
    const output = journal.finish({ ok: false });
    assert.equal(output.logFile, undefined);
    assert.equal(output.logFailure.code, 'EIO');
  });
  await test('fsync denial does not claim confirmed journal', () => {
    const journal = createMaintenanceJournal({ userDataPath: area('sync-denied'), action: 'context-clean', fs: filesystemFailure('fsyncSync', 'EIO') });
    const output = journal.finish({ ok: true });
    assert.equal(output.logFile, undefined);
    assert.equal(output.logFailure.stage, 'begin');
  });
  await test('short writes are completed; progress after finish is a no-op', () => {
    const io = new Proxy(fs, { get(target, key) {
      if (key === 'writeSync') return (fd, data, offset, length, position) => fs.writeSync(fd, data, offset, Math.min(7, length), position);
      return target[key];
    } });
    const journal = createMaintenanceJournal({ userDataPath: area('short-write'), action: 'context-clean', fs: io });
    const output = journal.finish({ ok: true });
    journal.progress('fail', 'must not append');
    assert.equal(entries(output.logFile).length, 2);
    assert.equal(output.logFailure, undefined);
  });
  await test('progress failure retains saved prefix and reports exact stage', () => {
    let writes = 0;
    const io = new Proxy(fs, { get(target, key) {
      if (key === 'writeSync') return (...args) => {
        if (++writes > 1) throw Object.assign(Error('synthetic disk full'), { code: 'ENOSPC' });
        return fs.writeSync(...args);
      };
      return target[key];
    } });
    const journal = createMaintenanceJournal({ userDataPath: area('progress-denied'), action: 'context-clean', fs: io });
    journal.progress('info', 'later');
    const output = journal.finish({ ok: false });
    assert(output.logFile);
    assert.equal(output.logFailure.stage, 'progress');
    assert.equal(output.logFailure.code, 'ENOSPC');
    assert.equal(entries(output.logFile).length, 1);
  });
  await test('refuse non-absolute and unknown journal action', () => {
    assert.equal(createMaintenanceJournal({ userDataPath: 'relative', action: 'context-clean' }).finish({}).logFailure.code, 'UNSAFE_LOG_PATH');
    assert.equal(createMaintenanceJournal({ userDataPath: root, action: '../escape' }).finish({}).logFailure.code, 'UNSAFE_LOG_PATH');
  });
  await test('refuse linked directory / ancestor without outside writes', () => {
    const outside = area('link-outside');
    const userDataPath = area('linked-directory');
    fs.symlinkSync(outside, path.join(userDataPath, 'logs'), process.platform === 'win32' ? 'junction' : 'dir');
    const output = createMaintenanceJournal({ userDataPath, action: 'context-clean' }).finish({});
    assert.equal(output.logFailure.code, 'UNSAFE_LOG_PATH');
    assert.deepEqual(fs.readdirSync(outside), []);
    const linkedAncestor = path.join(area('ancestor'), 'redirect');
    fs.symlinkSync(outside, linkedAncestor, process.platform === 'win32' ? 'junction' : 'dir');
    const ancestorOutput = createMaintenanceJournal({ userDataPath: path.join(linkedAncestor, 'child'), action: 'context-clean' }).finish({});
    assert.equal(ancestorOutput.logFailure.code, 'UNSAFE_LOG_PATH');
    assert.deepEqual(fs.readdirSync(outside), []);
  });
  await test('refuse hard-linked latest file before truncate', () => {
    const userDataPath = area('hard-link');
    const logs = path.join(userDataPath, 'logs'); fs.mkdirSync(logs);
    const outside = path.join(area('hard-link-outside'), 'original.txt'); fs.writeFileSync(outside, 'retain baseline');
    fs.linkSync(outside, path.join(logs, 'context-clean-latest.jsonl'));
    const output = createMaintenanceJournal({ userDataPath, action: 'context-clean' }).finish({});
    assert.equal(output.logFailure.code, 'UNSAFE_LOG_PATH');
    assert.equal(fs.readFileSync(outside, 'utf8'), 'retain baseline');
  });
  await test('reject latest file replacement before progress', () => {
    const userDataPath = area('replacement');
    const journal = createMaintenanceJournal({ userDataPath, action: 'context-clean' });
    const file = journal.metadata().logFile;
    fs.renameSync(file, file + '.fixture-retained');
    fs.writeFileSync(file, 'new independent file');
    const output = journal.progress('info', 'must not reach replacement');
    journal.finish({ ok: false });
    assert.equal(output.logFailure.code, 'UNSAFE_LOG_PATH');
    assert.equal(output.logFile, undefined);
    assert.equal(fs.readFileSync(file, 'utf8'), 'new independent file');
  });

  async function ipcFixture(name, journalFactory = createMaintenanceJournal, failGetPath = false) {
    const userDataPath = area(name), handlers = {}, messages = [], requests = [];
    let beginCalls = 0;
    class Window extends EventEmitter {
      constructor() {
        super(); this.webContents = new EventEmitter();
        this.webContents.send = (channel, body) => messages.push({ channel, ...body });
        this.webContents.isDestroyed = () => false;
      }
      setMenuBarVisibility() {} loadFile() {}
      static getAllWindows() { return []; }
    }
    class Host {
      constructor() { this.current = null; }
      run(action, log) {
        this.current = {};
        return new Promise(resolve => requests.push({ action, log, complete: result => { this.current = null; resolve(result); } }));
      }
    }
    class Editor { hide() {} close() {} }
    const app = new EventEmitter(); app.getPath = name => {
      assert.equal(name, 'userData');
      if (failGetPath) throw Object.assign(Error('synthetic app userData setup failure'), { code: 'EACCES' });
      return userDataPath;
    };
    app.whenReady = () => Promise.resolve(); app.quit = () => {};
    const electron = { app, BrowserWindow: Window, WebContentsView: class {}, ipcMain: { handle: (channel, handler) => { handlers[channel] = handler; } }, shell: {}, utilityProcess: {} };
    const context = vm.createContext({ __dirname: path.resolve(__dirname, '../cc-unlock-codex'), process, console, require: id => {
      if (id === 'electron') return electron;
      if (id === 'path') return path;
      if (id === './deploy-core') return { PATHS: { CODEX_DIR: root } };
      if (id === './chat-editor-host') return { ChatEditorHost: Editor, createServer: () => ({}) };
      if (id === './context-host') return { ContextHost: Host };
      if (id === './maintenance-log') return { createMaintenanceJournal: options => { beginCalls++; return journalFactory(options); } };
      throw Error('Unexpected main require: ' + id);
    } });
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../cc-unlock-codex/main.js'), 'utf8'), context);
    await new Promise(resolve => setImmediate(resolve));
    const sender = vm.runInContext('mainWindow.webContents', context);
    return { userDataPath, handlers, messages, requests, sender, begins: () => beginCalls };
  }
  await test('actual main IPC denies foreign renderer before journal / worker', async () => {
    const fixture = await ipcFixture('ipc-foreign');
    const output = await fixture.handlers['context-clean']({ sender: { isDestroyed: () => false, send() {} } });
    assert.equal(output.ok, false);
    assert.equal(fixture.begins(), 0);
    assert.equal(fixture.requests.length, 0);
    assert.deepEqual(fs.readdirSync(fixture.userDataPath), []);
  });
  await test('actual main IPC busy requests never clobber running journal', async () => {
    const fixture = await ipcFixture('ipc-busy');
    const pending = fixture.handlers['context-clean']({ sender: fixture.sender });
    assert.equal(fixture.requests.length, 1);
    fixture.requests[0].log('info', 'in-progress fixture');
    const file = path.join(fixture.userDataPath, 'logs', 'context-clean-latest.jsonl');
    const before = fs.readFileSync(file, 'utf8');
    for (const action of ['context-clean', 'context-scan']) {
      const result = await fixture.handlers[action]({ sender: fixture.sender });
      assert.equal(result.busy, true);
    }
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.equal(fixture.begins(), 1);
    fixture.requests[0].complete({ ok: false, filesScanned: 633, failures: [{ file: 'synthetic.lock', stage: 'unlink', code: 'EPERM', error: 'genuine failure fixture' }] });
    const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(result.failures[0].code, 'EPERM');
    assert.equal(result.logFile, file);
    assert.equal(entries(file).at(-1).summary.failures[0].code, 'EPERM');
  });
  await test('actual main IPC continues maintenance on journal filesystem failure', async () => {
    const fixture = await ipcFixture('ipc-log-denied', options => createMaintenanceJournal({ ...options, fs: filesystemFailure('mkdirSync') }));
    const pending = fixture.handlers['context-clean']({ sender: fixture.sender });
    assert.equal(fixture.requests.length, 1);
    fixture.requests[0].log('fail', 'synthetic actual cleanup failure EPERM');
    fixture.requests[0].complete({ ok: false, failures: [{ code: 'EPERM', error: 'synthetic actual cleanup failure' }] });
    const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(result.failures[0].code, 'EPERM');
    assert.equal(result.logFailure.code, 'EACCES');
    assert.equal(result.logFile, undefined);
    assert(fixture.messages.some(message => message.kind === 'warn' && message.text.includes('日志未完整保存')));
    assert(fixture.messages.some(message => message.kind === 'fail' && message.text.includes('EPERM')));
  });
  await test('actual main IPC captures worker-level error and unlocks next action', async () => {
    const fixture = await ipcFixture('ipc-worker-error');
    const pending = fixture.handlers['context-scan']({ sender: fixture.sender });
    fixture.requests[0].complete({ ok: false, error: '后台维护提前退出（1），未确认完成。' });
    const result = await pending;
    assert.equal(entries(result.logFile).at(-1).summary.error, result.error);
    const next = fixture.handlers['context-scan']({ sender: fixture.sender });
    assert.equal(fixture.requests.length, 2);
    fixture.requests[1].complete({ ok: true, filesScanned: 1 });
    assert.equal((await next).ok, true);
    assert.equal(entries(result.logFile).length, 2);
  });
  await test('actual main IPC continues if Electron userData setup fails', async () => {
    const fixture = await ipcFixture('ipc-userdata-failure', createMaintenanceJournal, true);
    const pending = fixture.handlers['context-clean']({ sender: fixture.sender });
    assert.equal(fixture.requests.length, 1);
    fixture.requests[0].complete({ ok: true, filesScanned: 1 });
    const result = await pending;
    assert.equal(result.ok, true);
    assert.equal(result.logFailure.code, 'EACCES');
    assert.equal(result.logFailure.stage, 'begin');
    assert.equal(result.logFile, undefined);
    assert(fixture.messages.some(message => message.kind === 'warn'));
  });
  process.stdout.write(`\n${passed}/18 passed; synthetic fixture evidence: ${root}\n`);
}
main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
