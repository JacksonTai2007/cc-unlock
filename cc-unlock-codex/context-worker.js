'use strict';

// Runs outside the Electron main process. Both utilityProcess and plain Node fork are supported.
const core = require('./deploy-core');
const port = process.parentPort;
const send = message => port ? port.postMessage(message) : process.send && process.send(message);
let started = false;

function receive(message) {
  if (started) return;
  started = true;
  const requestId = message && message.requestId;
  try {
    if (!message || !['context-scan', 'context-clean'].includes(message.action)) throw new Error('不支持的上下文操作');
    const input = message.opts || {};
    if (typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => !['clearStaleLocks', 'repairLineage'].includes(key))
      || Object.values(input).some(value => typeof value !== 'boolean')) {
      throw new Error('上下文操作参数无效');
    }
    const opts = { clearStaleLocks: input.clearStaleLocks === true, repairLineage: input.repairLineage === true };
    const log = (kind, text) => send({ type: 'progress', requestId, kind, text });
    const result = message.action === 'context-scan'
      ? core.scanInjectedContext({}, log) : core.cleanInjectedContext(opts, log);
    send({ type: 'result', requestId, result });
  } catch (err) {
    send({ type: 'error', requestId, error: String(err && err.message || err) });
  }
  setTimeout(() => process.exit(0), 30);
}

if (port) port.on('message', event => receive(event.data));
else process.on('message', receive);
send({ type: 'ready' });
