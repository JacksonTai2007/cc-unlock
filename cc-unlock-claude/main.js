// cc-unlock for Claude Code — Electron main process (window + IPC).
// All deploy logic lives in deploy-core.js (pure Node, testable / CLI-reusable).
'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const core = require('./deploy-core');

const APP = __dirname;

// ---------------- IPC ----------------
function wireIpc() {
  ipcMain.handle('detect', () => core.detect());
  ipcMain.handle('paths', () => ({ bundle: core.PATHS.CCF, claudeDir: core.PATHS.CLAUDE_DIR, projects: core.PATHS.PROJECTS }));
  ipcMain.handle('listWorkspaces', () => core.listWorkspaces());

  ipcMain.handle('deploy', (ev, { targets, opts }) => {
    const log = (kind, text) => ev.sender.send('deploy-log', { kind, text });
    for (const w of core.resolveTargets(targets)) {
      if (!core.exists(w.path)) { log('fail', `无法解析工作区路径: ${w.name}`); continue; }
      core.deployWorkspace(w.path, opts || {}, log);
    }
    core.deploySettings(log);
    log('done', '完成。请重启 Claude Code。');
    return { ok: true };
  });

  ipcMain.handle('uninstall', (ev, { targets }) => {
    const log = (kind, text) => ev.sender.send('uninstall-log', { kind, text });
    for (const w of core.resolveTargets(targets)) {
      if (!core.exists(w.path)) { log('warn', `跳过（路径不存在）: ${w.name}`); continue; }
      core.uninstallWorkspace(w.path, log);
    }
    log('done', '完成。请重启 Claude Code。');
    return { ok: true };
  });

  ipcMain.handle('verify', (ev, { targets }) => {
    const log = (kind, text) => ev.sender.send('verify-log', { kind, text });
    for (const w of core.resolveTargets(targets)) {
      if (!core.exists(w.path)) { log('warn', `跳过（路径不存在）: ${w.name}`); continue; }
      core.verifyWorkspace(w.path, log);
    }
    log('done', '验证完成。');
    return { ok: true };
  });

  ipcMain.handle('browse', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('openExternal', (_e, url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); });
}

// ---------------- Window ----------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1120, height: 760, minWidth: 900, minHeight: 600,
    backgroundColor: '#161616',
    title: 'cc-unlock for Claude Code',
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
