'use strict';

const path = require('node:path');
const { randomUUID } = require('node:crypto');

class ContextHost {
  constructor(fork, script = path.join(__dirname, 'context-worker.js')) {
    this.fork = fork;
    this.script = script;
    this.current = null;
  }

  run(action, log) {
    if (!['context-scan', 'context-clean'].includes(action)) return Promise.resolve({ ok: false, error: '未知维护动作。' });
    if (this.current) return Promise.resolve({ ok: false, busy: true, error: '另一项维护正在执行，请等待完成。' });
    return new Promise(resolve => {
      const requestId = randomUUID();
      let child;
      try { child = this.fork(this.script); }
      catch (error) { resolve({ ok: false, error: String(error.message || error) }); return; }
      let settled = false;
      this.current = child;
      const settle = result => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.current === child) this.current = null;
        resolve(result);
      };
      // UI gets an actionable timeout instead of a permanently pending IPC call.
      const timer = setTimeout(() => {
        settle({ ok: false, error: '维护超时，已停止后台扫描；请缩小范围后重试。' });
        try { child.kill(); } catch { /* Worker may have exited already. */ }
      }, 180000);
      child.on('message', message => {
        if (settled || !message || typeof message !== 'object') return;
        if (message.type === 'ready') {
          child.postMessage({ action, requestId, opts: { repairLineage: false, clearStaleLocks: action === 'context-clean' } });
          return;
        }
        if (message.requestId !== requestId) return;
        if (message.type === 'progress') log(message.kind || 'info', String(message.text || ''));
        else if (message.type === 'result') settle(message.result || { ok: false, error: '后台返回空结果。' });
        else if (message.type === 'error') settle({ ok: false, error: String(message.error || '后台维护失败。') });
      });
      child.once('error', error => settle({ ok: false, error: String(error.message || error) }));
      child.once('exit', code => {
        if (!settled) settle({ ok: false, error: `后台维护提前退出（${code}），未确认完成。` });
      });
    });
  }
}

module.exports = { ContextHost };
