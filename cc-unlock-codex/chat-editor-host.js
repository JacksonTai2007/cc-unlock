'use strict';

// The editor is a sandboxed local web view, never a privileged deployer renderer.
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');
const runFile = promisify(execFile);
const PAYLOAD_FILES = Object.freeze([
  'app.py', 'launch.py', 'editor_core.py', 'message_edit.py', 'force_edit.py',
  'writer_lock_cleanup.py', 'index.html', 'fixtures.py',
  'editor.css', 'editor-api.js', 'editor-view.js', 'editor-dialog.js', 'editor-actions.js', 'editor.js',
]);

function localUrl(value) {
  if (typeof value !== 'string' || !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!url.port || Number(url.port) < 1 || Number(url.port) > 65535) return null;
    return url.origin;
  } catch (_) { return null; }
}

function allowedNavigation(value, base) {
  try {
    const url = new URL(value);
    return localUrl(base) === base && url.origin === base && url.pathname === '/' &&
      !url.username && !url.password && (!url.search || url.search === '?embedded=1');
  } catch (_) { return false; }
}

function clampBounds(input, content) {
  if (!input || !['x', 'y', 'width', 'height'].every(k => typeof input[k] === 'number' && Number.isFinite(input[k]))) {
    throw new Error('编辑区域尺寸无效。');
  }
  const width = Math.max(0, Math.floor(content.width));
  const height = Math.max(0, Math.floor(content.height));
  const x = Math.min(width, Math.max(0, Math.floor(input.x)));
  const y = Math.min(height, Math.max(0, Math.floor(input.y)));
  return { x, y, width: Math.min(width - x, Math.max(0, Math.floor(input.width))),
    height: Math.min(height - y, Math.max(0, Math.floor(input.height))) };
}

function validPythonVersion(value) {
  const match = /^Python\s+(\d+)\.(\d+)\./m.exec(value);
  return !!match && (Number(match[1]) > 3 || (Number(match[1]) === 3 && Number(match[2]) >= 10));
}

async function findPython(env = process.env, runner = runFile) {
  const candidates = [];
  // This setting is one executable path, never a command line or shell fragment.
  if (env.CC_UNLOCK_PYTHON && path.isAbsolute(env.CC_UNLOCK_PYTHON) &&
      /^(?:python(?:\d+(?:\.\d+)?)?)(?:\.exe)?$/i.test(path.basename(env.CC_UNLOCK_PYTHON))) {
    candidates.push([env.CC_UNLOCK_PYTHON, []]);
  }
  if (env.LOCALAPPDATA) {
    const root = path.join(env.LOCALAPPDATA, 'Programs', 'Python');
    try {
      for (const dir of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))) {
        if (dir.isDirectory() && /^Python\d+[a-z]*$/i.test(dir.name)) candidates.push([path.join(root, dir.name, 'python.exe'), []]);
      }
    } catch (_) { /* Try the system Python launcher next. */ }
  }
  if (process.platform === 'win32') candidates.push(['py', ['-3']]);
  candidates.push(['python', []], ['python3', []]);
  for (const [executable, prefix] of candidates) {
    try {
      const result = await runner(executable, [...prefix, '--version'], { windowsHide: true, timeout: 4000, maxBuffer: 65536 });
      if (validPythonVersion(result.stdout + '\n' + result.stderr)) return { executable, prefix };
    } catch (_) { /* Missing/unsupported interpreters are not launched with code. */ }
  }
  const error = new Error('需要 Python 3.10 或更新版本。安装后重试，或把 CC_UNLOCK_PYTHON 设置为 python.exe 的完整路径。');
  error.code = 'MISSING_PYTHON';
  throw error;
}

function checkedDirectory(directory) {
  // Refuse redirected cache folders rather than copying application files elsewhere.
  const absolute = path.resolve(directory);
  const parent = path.dirname(absolute);
  if (parent !== absolute) checkedDirectory(parent);
  if (!fs.existsSync(absolute)) fs.mkdirSync(absolute);
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('编辑器缓存目录不能是链接：' + absolute);
}

function stagePayload(source, destination) {
  checkedDirectory(destination);
  for (const name of PAYLOAD_FILES) {
    const from = path.join(source, name);
    const to = path.join(destination, name);
    const stat = fs.lstatSync(from);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('编辑器组件无效：' + name);
    if (fs.existsSync(to) && (!fs.lstatSync(to).isFile() || fs.lstatSync(to).isSymbolicLink())) {
      throw new Error('编辑器缓存文件不能是链接：' + name);
    }
    const bytes = fs.readFileSync(from);
    if (!fs.existsSync(to) || !bytes.equals(fs.readFileSync(to))) fs.writeFileSync(to, bytes);
  }
  const sourceText = fs.readFileSync(path.join(source, 'app.py'), 'utf8');
  const match = /^APP_VERSION\s*=\s*['"]([^'"]+)['"]/m.exec(sourceText);
  if (!match) throw new Error('无法读取编辑器版本。');
  return match[1];
}

function getHealth(base) {
  if (!localUrl(base)) return Promise.reject(new Error('编辑器地址不是有效的本机地址。'));
  return new Promise((resolve, reject) => {
    const request = http.get(base + '/health', { headers: { 'Cache-Control': 'no-cache' }, timeout: 3000 }, response => {
      // http.get does not follow redirects; never contact a metadata-supplied remote host.
      if (response.statusCode !== 200) { response.resume(); reject(new Error('编辑器健康检查失败：HTTP ' + response.statusCode)); return; }
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; if (text.length > 65536) request.destroy(new Error('编辑器健康检查响应过大。')); });
      response.on('error', reject);
      response.on('end', () => { try { resolve(JSON.parse(text)); } catch (_) { reject(new Error('编辑器健康检查格式无效。')); } });
    });
    request.on('timeout', () => request.destroy(new Error('编辑器健康检查超时。')));
    request.on('error', reject);
  });
}

function validHealth(health, version) {
  return health && health.app === 'codex-chat-editor' && health.version === version &&
    health.mode === 'live' && health.update_required === false && /^[a-f0-9]{64}$/.test(health.build_id);
}

class EditorServer {
  constructor({ source, destination, home, runner = runFile, pythonFinder = findPython, healthReader = getHealth }) {
    this.source = source; this.destination = destination; this.home = home;
    this.runner = runner; this.pythonFinder = pythonFinder; this.healthReader = healthReader;
    this.pending = null; this.generation = null;
  }
  ensure() {
    if (!this.pending) this.pending = this.start().finally(() => { this.pending = null; });
    return this.pending;
  }
  async start() {
    this.generation = null;
    const version = stagePayload(this.source, this.destination);
    const python = await this.pythonFinder();
    // launch.py authenticates/reuses its own matching server and starts no browser.
    const result = await this.runner(python.executable, [...python.prefix,
      path.join(this.destination, 'launch.py'), '--no-open', '--home', path.resolve(this.home)],
    { cwd: this.destination, windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    const lines = result.stdout.trim().split(/\r?\n/);
    const url = localUrl(lines[lines.length - 1]);
    if (!url) throw new Error('编辑器没有返回有效的本机服务地址。');
    const health = await this.healthReader(url);
    if (!validHealth(health, version)) throw new Error('编辑器身份或版本不匹配，未载入页面。');
    this.generation = health.instance_id || health.build_id;
    return url;
  }
}

class ChatEditorHost {
  constructor(win, WebContentsView, server) {
    this.win = win; this.WebContentsView = WebContentsView; this.server = server;
    this.view = null; this.url = null; this.generation = null; this.added = false; this.desiredVisible = false;
    this.closed = false; this.bounds = { x: 0, y: 0, width: 0, height: 0 }; this.loading = null;
  }
  async open(bounds) {
    if (this.closed || this.win.isDestroyed()) return { ok: false, error: '窗口已关闭。' };
    try {
      this.bounds = clampBounds(bounds, this.win.getContentBounds());
      this.desiredVisible = true;
      if (!this.loading) this.loading = this.load().finally(() => { this.loading = null; });
      await this.loading;
      if (this.closed || !this.desiredVisible) return { ok: true, hidden: true };
      this.view.setBounds(this.bounds);
      if (!this.added) { this.win.contentView.addChildView(this.view); this.added = true; }
      return { ok: true, url: this.url };
    } catch (error) { this.generation = null; return { ok: false, error: error.message || String(error), code: error.code }; }
  }
  async load() {
    const url = await this.server.ensure();
    if (this.closed) return;
    if (!this.view) {
      this.view = new this.WebContentsView({ webPreferences: {
        nodeIntegration: false, contextIsolation: true, sandbox: true,
        partition: 'cc-unlock-chat-editor',
      } });
      const contents = this.view.webContents;
      contents.setWindowOpenHandler(() => ({ action: 'deny' }));
      contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      contents.session.setPermissionCheckHandler(() => false);
      for (const event of ['will-navigate', 'will-redirect', 'will-frame-navigate']) {
        contents.on(event, (ev, destination) => {
          const value = typeof destination === 'string' ? destination : ev.url;
          if (!allowedNavigation(value, this.url)) ev.preventDefault();
        });
      }
      contents.on('will-attach-webview', ev => ev.preventDefault());
    }
    const generation = this.server.generation;
    // A restarted server may reuse its port but issue a new token. Preserve drafts
    // across simple tab switches, and refresh the document only for a new instance.
    if (this.url !== url || this.generation !== generation) {
      this.url = url;
      try {
        await this.view.webContents.loadURL(url + '/?embedded=1');
        this.generation = generation;
      } catch (error) { this.url = null; this.generation = null; throw error; }
    }
  }
  hide() {
    this.desiredVisible = false;
    if (this.added && !this.win.isDestroyed()) this.win.contentView.removeChildView(this.view);
    this.added = false;
    return { ok: true };
  }
  resize(bounds) {
    try {
      this.bounds = clampBounds(bounds, this.win.getContentBounds());
      if (this.view && !this.closed) this.view.setBounds(this.bounds);
      return { ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  close() {
    this.hide(); this.closed = true;
    if (this.view && !this.view.webContents.isDestroyed()) this.view.webContents.close();
    this.view = null;
    // Keep the authenticated detached server available to another editor window.
  }
}

function createServer(app, home) {
  return new EditorServer({
    source: path.join(app.isPackaged ? process.resourcesPath : __dirname, 'chat-editor'),
    destination: path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.cache'), 'cc-unlock-codex', 'chat-editor'),
    home,
  });
}

module.exports = { PAYLOAD_FILES, localUrl, allowedNavigation, clampBounds, validPythonVersion,
  findPython, stagePayload, getHealth, validHealth, EditorServer, ChatEditorHost, createServer };
