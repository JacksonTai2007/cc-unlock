'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const host = require('./chat-editor-host');

test('loopback URL parser rejects credentials, queries, fragments and remote hosts', () => {
  assert.equal(host.localUrl('http://127.0.0.1:59418/'), 'http://127.0.0.1:59418');
  for (const url of ['https://127.0.0.1:1234', 'http://localhost:1234', 'http://127.0.0.1:1234/health',
    'http://127.0.0.1:1234#x', 'http://evil@127.0.0.1:1234', 'http://127.0.0.1:0', 'http://127.0.0.1:99999']) assert.equal(host.localUrl(url), null);
});
test('navigation stays within the verified editor document', () => {
  assert.equal(host.allowedNavigation('http://127.0.0.1:59418/#message', 'http://127.0.0.1:59418'), true);
  assert.equal(host.allowedNavigation('http://127.0.0.1:59418/?embedded=1', 'http://127.0.0.1:59418'), true);
  for (const url of ['file:///C:/private', 'http://127.0.0.1:59419/', 'http://127.0.0.1:59418/api/status', 'https://example.com/',
    'http://127.0.0.1:59418/?embedded=0', 'http://127.0.0.1:59418/?embedded=1&other=1', 'http://127.0.0.1:59418/?anything=1']) {
    assert.equal(host.allowedNavigation(url, 'http://127.0.0.1:59418'), false);
  }
});
test('bounds are finite and clipped to the main window', () => {
  assert.deepEqual(host.clampBounds({ x: -10, y: 90.4, width: 9999, height: 100 }, { width: 500, height: 100 }), { x: 0, y: 90, width: 500, height: 10 });
  assert.throws(() => host.clampBounds({ x: NaN, y: 0, width: 1, height: 1 }, { width: 5, height: 5 }));
});
test('Python discovery requires 3.10+ and uses argv, not a shell command', async () => {
  assert.equal(host.validPythonVersion('Python 3.9.2'), false);
  assert.equal(host.validPythonVersion('Python 3.14.0'), true);
  const calls = [];
  const python = await host.findPython({}, async (executable, args, options) => {
    calls.push({ executable, args, options });
    return { stdout: executable === 'python' ? 'Python 3.12.1' : 'Python 3.8.0', stderr: '' };
  });
  assert.equal(python.executable, 'python');
  assert.ok(calls.every(call => call.options.windowsHide && !call.options.shell));
});
test('missing Python is an actionable result', async () => {
  await assert.rejects(host.findPython({}, async () => { throw new Error('ENOENT'); }), { code: 'MISSING_PYTHON' });
});
test('health requires exact identity, version, live mode and current build', () => {
  const health = { app: 'codex-chat-editor', version: '1.4', mode: 'live', update_required: false, build_id: 'a'.repeat(64) };
  assert.equal(host.validHealth(health, '1.4'), true);
  for (const patch of [{ app: 'other' }, { mode: 'demo' }, { update_required: true }, { version: 'old' }, { build_id: '' }]) assert.equal(host.validHealth({ ...health, ...patch }, '1.4'), false);
});
test('runtime staging copies whitelist only and preserves runtime metadata', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-editor-host-'));
  const source = path.join(temp, 'source'); const destination = path.join(temp, 'cache');
  fs.mkdirSync(source); fs.mkdirSync(destination);
  try {
    for (const name of host.PAYLOAD_FILES) fs.writeFileSync(path.join(source, name), name === 'app.py' ? "APP_VERSION = '1.4'\n" : name);
    fs.writeFileSync(path.join(source, 'user-data.sqlite'), 'must not be copied');
    fs.writeFileSync(path.join(destination, 'running.json'), '{}');
    assert.equal(host.stagePayload(source, destination), '1.4');
    assert.equal(fs.existsSync(path.join(destination, 'user-data.sqlite')), false);
    assert.equal(fs.readFileSync(path.join(destination, 'running.json'), 'utf8'), '{}');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

function fixture(server) {
  const views = []; const added = new Set();
  class FakeView {
    constructor(options) {
      this.options = options; this.bounds = null; this.loads = [];
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, {
        session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} },
        setWindowOpenHandler: callback => { this.openHandler = callback; },
        loadURL: async url => { this.loaded = url; this.loads.push(url); }, isDestroyed: () => false,
        close: () => { this.closed = true; },
      }); views.push(this);
    }
    setBounds(bounds) { this.bounds = bounds; }
  }
  const win = { isDestroyed: () => false, getContentBounds: () => ({ width: 1100, height: 700 }),
    contentView: { addChildView: v => added.add(v), removeChildView: v => added.delete(v) } };
  return { manager: new host.ChatEditorHost(win, FakeView, server), views, added };
}
const BOUNDS = { x: 210, y: 60, width: 800, height: 600 };

test('embedded view is sandboxed, resized and removed without killing server', async () => {
  const { manager, views, added } = fixture({ ensure: async () => 'http://127.0.0.1:59418' });
  assert.equal((await manager.open(BOUNDS)).ok, true);
  assert.equal(added.size, 1);
  assert.equal(views[0].loaded, 'http://127.0.0.1:59418/?embedded=1');
  assert.deepEqual(views[0].options.webPreferences, { nodeIntegration: false, contextIsolation: true, sandbox: true, partition: 'cc-unlock-chat-editor' });
  assert.equal(views[0].openHandler().action, 'deny');
  let prevented = false;
  views[0].webContents.emit('will-navigate', { preventDefault() { prevented = true; } }, 'https://example.com');
  assert.equal(prevented, true);
  manager.resize({ ...BOUNDS, width: 300 }); assert.equal(views[0].bounds.width, 300);
  manager.hide(); assert.equal(added.size, 0);
  await manager.open(BOUNDS); assert.equal(views.length, 1); assert.equal(added.size, 1);
  manager.close(); assert.equal(views[0].closed, true); assert.equal(added.size, 0);
});
test('navigation away during startup never shows a stale editor', async () => {
  let resolve;
  const { manager, added } = fixture({ ensure: () => new Promise(done => { resolve = done; }) });
  const opening = manager.open(BOUNDS);
  manager.hide(); resolve('http://127.0.0.1:59418');
  assert.equal((await opening).hidden, true); assert.equal(added.size, 0);
});
test('chat-other-chat during startup uses the latest bounds and one view', async () => {
  let resolve; let launches = 0;
  const { manager, added, views } = fixture({ ensure: () => { launches++; return new Promise(done => { resolve = done; }); } });
  const first = manager.open(BOUNDS); manager.hide();
  const second = manager.open({ ...BOUNDS, width: 500 }); resolve('http://127.0.0.1:59418');
  await Promise.all([first, second]); assert.equal(launches, 1); assert.equal(added.size, 1);
  assert.equal(views.length, 1); assert.equal(views[0].bounds.width, 500);
});
test('closing a window during startup does not create a view', async () => {
  let resolve;
  const { manager, views } = fixture({ ensure: () => new Promise(done => { resolve = done; }) });
  const opening = manager.open(BOUNDS); manager.close(); resolve('http://127.0.0.1:59418');
  await opening; assert.equal(views.length, 0);
});
test('same server instance preserves the embedded page and unsaved drafts', async () => {
  const server = { generation: 'instance-a', ensure: async () => 'http://127.0.0.1:59418' };
  const { manager, views } = fixture(server);
  await manager.open(BOUNDS); manager.hide(); await manager.open(BOUNDS);
  assert.equal(views[0].loads.length, 1); assert.equal(manager.generation, 'instance-a');
});
test('new server generation at the same port reloads the document token', async () => {
  const server = { generation: 'instance-a', ensure: async () => 'http://127.0.0.1:59418' };
  const { manager, views } = fixture(server);
  await manager.open(BOUNDS); manager.hide(); server.generation = 'instance-b';
  await manager.open(BOUNDS);
  assert.deepEqual(views[0].loads, ['http://127.0.0.1:59418/?embedded=1', 'http://127.0.0.1:59418/?embedded=1']);
  assert.equal(manager.generation, 'instance-b');
});
test('failed reload clears instance state and retry loads a fresh document', async () => {
  const server = { generation: 'instance-a', ensure: async () => 'http://127.0.0.1:59418' };
  const { manager, views } = fixture(server);
  await manager.open(BOUNDS); manager.hide(); server.generation = 'instance-b';
  const loader = views[0].webContents.loadURL;
  views[0].webContents.loadURL = async () => { throw new Error('connection failed'); };
  assert.equal((await manager.open(BOUNDS)).ok, false); assert.equal(manager.generation, null); assert.equal(manager.url, null);
  views[0].webContents.loadURL = loader;
  assert.equal((await manager.open(BOUNDS)).ok, true); assert.equal(manager.generation, 'instance-b');
});
