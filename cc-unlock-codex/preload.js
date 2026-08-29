// cc-unlock for Codex — preload bridge (context-isolated)
const { contextBridge, ipcRenderer } = require('electron');

function streamAction(channel, payload, onLog) {
  return new Promise((resolve) => {
    const logCh = channel + '-log';
    const handler = (_e, msg) => { if (onLog) onLog(msg.kind, msg.text); };
    ipcRenderer.on(logCh, handler);
    ipcRenderer.invoke(channel, payload).then((res) => {
      ipcRenderer.removeListener(logCh, handler); resolve(res);
    }).catch((err) => {
      ipcRenderer.removeListener(logCh, handler);
      if (onLog) onLog('fail', String(err && err.message || err)); resolve({ ok: false });
    });
  });
}

contextBridge.exposeInMainWorld('ccAPI', {
  detect: () => ipcRenderer.invoke('detect'),
  paths: () => ipcRenderer.invoke('paths'),
  deploy: (opts, onLog) => streamAction('deploy', { opts }, onLog),
  uninstall: (onLog) => streamAction('uninstall', {}, onLog),
  verify: (onLog) => streamAction('verify', {}, onLog),
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),
});
