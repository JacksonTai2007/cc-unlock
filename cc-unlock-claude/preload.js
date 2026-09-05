// cc-unlock for Claude Code — preload bridge (context-isolated)
const { contextBridge, ipcRenderer } = require('electron');

// Stream log lines from main during a long action, resolve when done.
function streamAction(channel, payload, onLog) {
  return new Promise((resolve) => {
    const logCh = channel + '-log';
    const handler = (_e, msg) => { if (onLog) onLog(msg.kind, msg.text); };
    ipcRenderer.on(logCh, handler);
    ipcRenderer.invoke(channel, payload).then((res) => {
      ipcRenderer.removeListener(logCh, handler);
      resolve(res);
    }).catch((err) => {
      ipcRenderer.removeListener(logCh, handler);
      if (onLog) onLog('fail', String(err && err.message || err));
      resolve({ ok: false });
    });
  });
}

contextBridge.exposeInMainWorld('ccAPI', {
  detect: () => ipcRenderer.invoke('detect'),
  paths: () => ipcRenderer.invoke('paths'),
  listWorkspaces: () => ipcRenderer.invoke('listWorkspaces'),
  deploy: (targets, opts, onLog) => streamAction('deploy', { targets, opts }, onLog),
  uninstall: (targets, onLog) => streamAction('uninstall', { targets }, onLog),
  verify: (targets, onLog) => streamAction('verify', { targets }, onLog),
  restore: (targets, onLog) => streamAction('restore', { targets }, onLog),
  browse: () => ipcRenderer.invoke('browse'),
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),
});
