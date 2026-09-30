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

  const actions = {
    deploy: { label: '部署', run: (workspace, opts, log) => core.deployWorkspace(workspace, opts, log) },
    uninstall: { label: '卸载', run: (workspace, _opts, log) => core.uninstallWorkspace(workspace, log) },
    verify: { label: '验证', run: (workspace, _opts, log) => core.verifyWorkspace(workspace, log) },
    restore: { label: '恢复', run: (workspace, _opts, log) => core.restoreWorkspace(workspace, log) },
  };
  const hasItems = (value) => Array.isArray(value) ? value.length > 0 : Boolean(value);
  for (const [channel, action] of Object.entries(actions)) {
    ipcMain.handle(channel, (ev, payload = {}) => {
      const log = (kind, text) => ev.sender.send(`${channel}-log`, { kind, text });
      const results = [];
      const targets = payload && payload.targets;
      if (!Array.isArray(targets) || targets.length === 0) {
        const error = '未提供工作区，未执行任何操作。';
        log('fail', error);
        return { ok: false, results, error };
      }
      for (const target of targets) {
        let workspace;
        const name = typeof target === 'string' ? target : target && (target.path || target.name) || '(无效目标)';
        try {
          workspace = core.resolveTargets([target])[0];
          if (!workspace || workspace.resolved === false || !workspace.path || !core.exists(workspace.path)) {
            const error = `跳过无法解析或不存在的工作区: ${workspace && workspace.name || name}`;
            results.push({ name, path: workspace && workspace.path || null, ok: false, skipped: true, error });
            log('fail', error);
            continue;
          }
          const result = action.run(workspace.path, payload.opts || {}, log);
          const skipped = Boolean(result && (hasItems(result.skipped) || result.noState));
          const conflict = Boolean(result && (hasItems(result.conflict) || hasItems(result.conflicts)));
          const ok = Boolean(result && result.ok === true && !skipped && !conflict);
          const error = ok ? undefined : result && result.error || (skipped ? '存在跳过项，未全部执行。' : conflict ? '存在文件冲突，未全部执行。' : '操作返回未通过结果。');
          results.push({ name: workspace.name || name, path: workspace.path, ok, result, ...(error ? { error } : {}) });
          if (!ok) log('fail', `${workspace.path}: ${error}`);
        } catch (error) {
          const message = String(error && error.message || error);
          results.push({ name, path: workspace && workspace.path || null, ok: false, error: message });
          log('fail', `${workspace && workspace.path || name}: ${message}`);
        }
      }
      const succeeded = results.filter((result) => result.ok).length;
      const failed = results.length - succeeded;
      const ok = results.length > 0 && failed === 0;
      const summary = `${action.label}结果：${succeeded} 个成功，${failed} 个未完成。`;
      log(ok ? 'done' : 'fail', summary);
      if (ok && channel === 'deploy') log('info', '请在原版 Claude Code 中新建会话读取工作区 CLAUDE.md。');
      return { ok, results, succeeded, failed, ...(ok ? {} : { error: summary }) };
    });
  }

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
