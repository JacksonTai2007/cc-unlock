// cc-unlock for Codex — Electron main process (window + IPC).
// All deploy logic lives in deploy-core.js (pure Node, testable / CLI-reusable).
'use strict';

const { app, BrowserWindow, WebContentsView, ipcMain, shell, utilityProcess } = require('electron');
const path = require('path');
const core = require('./deploy-core');
const { ChatEditorHost, createServer } = require('./chat-editor-host');
const { ContextHost } = require('./context-host');

const APP = __dirname;
let mainWindow = null;
let chatEditor = null;
let editorServer = null;
const contextHost = new ContextHost(script => utilityProcess.fork(script, [], { serviceName: 'cc-unlock-maintenance' }));

function wireIpc() {
  ipcMain.handle('detect', () => core.detect());
  ipcMain.handle('paths', () => ({ codexDir: core.PATHS.CODEX_DIR, bundle: core.PATHS.CODEX_FILES, skills: core.PATHS.SKILL_BUNDLE }));

  ipcMain.handle('deploy', (ev, { opts }) => {
    const log = (kind, text) => ev.sender.send('deploy-log', { kind, text });
    core.deployCodex(opts || {}, log);
    log('done', '完成。请重启 Codex。');
    return { ok: true };
  });

  ipcMain.handle('uninstall', (ev) => {
    const log = (kind, text) => ev.sender.send('uninstall-log', { kind, text });
    core.uninstallCodex(log);
    log('done', '完成。请重启 Codex。');
    return { ok: true };
  });

  ipcMain.handle('verify', (ev) => {
    const log = (kind, text) => ev.sender.send('verify-log', { kind, text });
    core.verifyCodex(log);
    log('done', '验证完成。');
    return { ok: true };
  });

  ipcMain.handle('context-scan', (ev) => {
    const log = (kind, text) => { if (!ev.sender.isDestroyed()) ev.sender.send('context-scan-log', { kind, text }); };
    if (!mainWindow || ev.sender !== mainWindow.webContents) return { ok: false, error: '不允许的维护请求。' };
    return contextHost.run('context-scan', log);
  });

  ipcMain.handle('context-clean', (ev) => {
    const log = (kind, text) => { if (!ev.sender.isDestroyed()) ev.sender.send('context-clean-log', { kind, text }); };
    if (!mainWindow || ev.sender !== mainWindow.webContents) return { ok: false, error: '不允许的维护请求。' };
    return contextHost.run('context-clean', log);
  });

  ipcMain.handle('restore', (ev) => {
    const log = (kind, text) => ev.sender.send('restore-log', { kind, text });
    return core.restoreOriginal(log);
  });

  ipcMain.handle('openExternal', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });

  // Only the app's main renderer owns this bridge; the embedded editor has none.
  for (const [channel, method] of [['chat-editor-open', 'open'], ['chat-editor-hide', 'hide'], ['chat-editor-resize', 'resize']]) {
    ipcMain.handle(channel, (event, bounds) => {
      if (!mainWindow || event.sender !== mainWindow.webContents || !chatEditor) return { ok: false, error: '不允许的编辑器请求。' };
      if (method === 'open' && contextHost.current) return { ok: false, error: '会话维护尚未结束，请完成后再编辑。' };
      return chatEditor[method](bounds);
    });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180, height: 800, minWidth: 720, minHeight: 520,
    backgroundColor: '#f5f6f8',
    title: 'cc-unlock for Codex',
    webPreferences: { preload: path.join(APP, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  mainWindow = win;
  editorServer = editorServer || createServer(app, core.PATHS.CODEX_DIR);
  const host = new ChatEditorHost(win, WebContentsView, editorServer);
  chatEditor = host;
  win.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame) host.hide(); });
  win.on('closed', () => {
    host.close();
    if (mainWindow === win) { mainWindow = null; chatEditor = null; }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(APP, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  wireIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
