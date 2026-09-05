// cc-unlock for Codex — Electron main process (window + IPC).
// All deploy logic lives in deploy-core.js (pure Node, testable / CLI-reusable).
'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const core = require('./deploy-core');

const APP = __dirname;

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

  ipcMain.handle('restore', (ev) => {
    const log = (kind, text) => ev.sender.send('restore-log', { kind, text });
    return core.restoreOriginal(log);
  });

  ipcMain.handle('openExternal', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1120, height: 760, minWidth: 900, minHeight: 600,
    backgroundColor: '#161616',
    title: 'cc-unlock for Codex',
    webPreferences: { preload: path.join(APP, 'preload.js'), contextIsolation: true, nodeIntegration: false },
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
