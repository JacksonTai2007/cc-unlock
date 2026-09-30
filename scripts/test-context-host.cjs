'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { ContextHost } = require('../cc-unlock-codex/context-host');

class Worker extends EventEmitter {
  postMessage(message) { this.request = message; }
  kill() { this.killed = true; }
}

test('one-click cleanup is async, preserves busy state and forwards progress/result', async () => {
  const worker = new Worker(), logs = [];
  const host = new ContextHost(() => worker);
  const promise = host.run('context-clean', (kind, text) => logs.push([kind, text]));
  assert.equal(host.current, worker);
  assert.equal((await host.run('context-clean', () => {})).busy, true);
  worker.emit('message', { type: 'ready' });
  const { requestId, opts } = worker.request;
  assert.equal(opts.clearStaleLocks, true);
  assert.equal(opts.repairLineage, false);
  worker.emit('message', { type: 'progress', requestId, kind: 'info', text: '合成扫描' });
  worker.emit('message', { type: 'result', requestId, result: { ok: false, status: 'blocked', filesChanged: 0 } });
  assert.deepEqual(await promise, { ok: false, status: 'blocked', filesChanged: 0 });
  assert.deepEqual(logs, [['info', '合成扫描']]);
  assert.equal(host.current, null);
});

test('unrelated worker messages cannot complete a request', async () => {
  const worker = new Worker(), host = new ContextHost(() => worker);
  const promise = host.run('context-scan', () => {});
  worker.emit('message', { type: 'ready' });
  assert.equal(worker.request.opts.clearStaleLocks, false);
  worker.emit('message', { type: 'result', requestId: 'foreign', result: { ok: true } });
  assert.equal(host.current, worker);
  worker.emit('message', { type: 'error', requestId: worker.request.requestId, error: '合成读取错误' });
  assert.equal((await promise).error, '合成读取错误');
});

test('exit without result is not reported as success', async () => {
  const worker = new Worker(), host = new ContextHost(() => worker);
  const promise = host.run('context-clean', () => {});
  worker.emit('exit', 1);
  assert.equal((await promise).ok, false);
  assert.equal(host.current, null);
});

test('fork failure and invalid action return actionable errors', async () => {
  const host = new ContextHost(() => { throw new Error('synthetic ENOENT'); });
  assert.equal((await host.run('context-clean', () => {})).error, 'synthetic ENOENT');
  assert.equal((await host.run('unknown', () => {})).ok, false);
});
