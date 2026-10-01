'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ACTIONS = new Set(['context-clean', 'context-scan']);
const COUNTS = ['filesScanned', 'filesEnumerated', 'filesWithMatches', 'recordsMatched',
  'invalidJsonLines', 'filesChanged', 'recordsNeutralized', 'fieldsNeutralized',
  'filesPossiblyChanged', 'uncertainWriteCount', 'recordsPartiallyNeutralized'];
const FLAGS = ['ok', 'busy', 'scanStarted', 'scanCompleted', 'requiresReload', 'diskOnly',
  'currentContextUpdated', 'transientWritesOccurred'];

function safeText(value) {
  if (typeof value !== 'string') return undefined;
  return value.replace(/\b(Bearer\s+)\S+/gi, '$1[REDACTED]')
    .replace(/([?&](?:api[_-]?key|token|secret|password|access[_-]?token)=)[^&#\s]*/gi, '$1[REDACTED]')
    .replace(/\b((?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

function diagnostic(item) {
  if (!item || typeof item !== 'object') return {};
  const output = {};
  for (const key of ['file', 'path', 'stage', 'code', 'error', 'reason', 'ntstatus']) {
    const value = safeText(item[key]);
    if (value !== undefined) output[key] = value;
  }
  if (Number.isSafeInteger(item.line)) output.line = item.line;
  return output;
}

function diagnostics(value, stringFiles = false) {
  return Array.isArray(value) ? value.map(item => stringFiles && typeof item === 'string' ? { file: safeText(item) } : diagnostic(item)) : [];
}

// Worker results contain match snapshots and inventories. Only operational facts
// belong in the journal; never serialize the result object wholesale.
function summarizeResult(result) {
  if (!result || typeof result !== 'object') return { ok: false, error: '后台返回空结果。' };
  const summary = {};
  for (const key of COUNTS) if (Number.isSafeInteger(result[key]) && result[key] >= 0) summary[key] = result[key];
  for (const key of FLAGS) if (typeof result[key] === 'boolean') summary[key] = result[key];
  for (const key of ['status', 'contextStatus', 'error']) {
    const value = safeText(result[key]);
    if (value !== undefined) summary[key] = value;
  }
  summary.failures = diagnostics(result.failures);
  summary.contextFailures = diagnostics(result.contextFailures);
  summary.concurrentConflicts = diagnostics(result.skippedChangedDuringScan, true);
  summary.uncertainWrites = diagnostics(result.uncertainWrites);
  const locks = result.threadWriterLocks;
  if (locks && typeof locks === 'object') {
    summary.threadWriterLocks = {
      removedCount: Array.isArray(locks.removed) ? locks.removed.length : 0,
      pendingDeletionCount: Array.isArray(locks.pendingDeletion) ? locks.pendingDeletion.length : 0,
      failures: diagnostics(locks.failures),
      pendingDeletion: diagnostics(locks.pendingDeletion),
      stateProbeFailures: diagnostics(locks.stateProbeFailures),
    };
    if (typeof locks.skipped === 'string') summary.threadWriterLocks.skipped = safeText(locks.skipped);
  }
  if (result.rollbacks && typeof result.rollbacks === 'object') {
    summary.rollbacks = {};
    for (const key of ['verified', 'unverified', 'refused']) {
      if (Number.isSafeInteger(result.rollbacks[key])) summary.rollbacks[key] = result.rollbacks[key];
    }
  }
  return summary;
}

function pathError(message) { return Object.assign(new Error(message), { code: 'UNSAFE_LOG_PATH' }); }
function sameFile(a, b) { return a.dev === b.dev && a.ino === b.ino; }

function checkDirectoryChain(io, directory, create) {
  const absolute = path.resolve(directory);
  const root = path.parse(absolute).root;
  let current = root;
  for (const part of [null, ...absolute.slice(root.length).split(path.sep).filter(Boolean)]) {
    if (part !== null) current = path.join(current, part);
    let stat;
    try { stat = io.lstatSync(current); }
    catch (error) {
      if (!create || error.code !== 'ENOENT') throw error;
      try { io.mkdirSync(current, { mode: 0o700 }); }
      catch (mkdirError) { if (mkdirError.code !== 'EEXIST') throw mkdirError; }
      stat = io.lstatSync(current);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw pathError(`日志目录不是普通目录: ${current}`);
  }
}

function createMaintenanceJournal({ userDataPath, action, fs: io = fs, clock = () => new Date() }) {
  let fd = null;
  let confirmed = false;
  let ended = false;
  let failure = null;
  let position = 0;
  let file;
  let directory;
  const metadata = () => ({ ...(confirmed ? { logFile: file } : {}), ...(failure ? { logFailure: failure } : {}) });
  const fail = (error, stage) => {
    if (!failure) failure = { stage, code: safeText(String(error.code || 'ERROR')), error: safeText(String(error.message || error)) };
    if (error.code === 'UNSAFE_LOG_PATH') confirmed = false;
    if (fd !== null) {
      try { io.closeSync(fd); } catch { /* Preserve the first actionable logging error. */ }
      fd = null;
    }
  };
  const checkFile = () => {
    checkDirectoryChain(io, directory, false);
    const opened = io.fstatSync(fd);
    const named = io.lstatSync(file);
    if (!opened.isFile() || opened.nlink !== 1 || named.isSymbolicLink() || !named.isFile() || named.nlink !== 1 || !sameFile(opened, named)) {
      throw pathError('日志文件已重定向或不是独立普通文件。');
    }
  };
  const write = (event) => {
    if (failure || fd === null) return metadata();
    try {
      checkFile();
      const bytes = Buffer.from(JSON.stringify({ timestamp: clock().toISOString(), action, ...event }) + '\n', 'utf8');
      let offset = 0;
      while (offset < bytes.length) {
        const count = io.writeSync(fd, bytes, offset, bytes.length - offset, position + offset);
        if (!Number.isSafeInteger(count) || count <= 0) throw Object.assign(new Error('日志写入未完成。'), { code: 'EIO' });
        offset += count;
      }
      io.fsyncSync(fd);
      position += bytes.length;
      confirmed = true;
    } catch (error) { fail(error, event.type); }
    return metadata();
  };
  try {
    if (!ACTIONS.has(action)) throw pathError('未知日志动作。');
    if (typeof userDataPath !== 'string' || !path.isAbsolute(userDataPath)) throw pathError('日志用户目录必须是绝对路径。');
    directory = path.join(path.resolve(userDataPath), 'logs');
    file = path.join(directory, `${action}-latest.jsonl`);
    checkDirectoryChain(io, directory, true);
    let existing = false;
    try {
      const stat = io.lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) throw pathError('日志目标不是独立普通文件。');
      existing = true;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    // Open before truncating, so a replaced link cannot redirect a destructive
    // open. Newly created journals use exclusive create against path races.
    const constants = io.constants || fs.constants;
    fd = io.openSync(file, constants.O_WRONLY | (constants.O_NOFOLLOW || 0) |
      (existing ? 0 : constants.O_CREAT | constants.O_EXCL), 0o600);
    checkFile();
    io.ftruncateSync(fd, 0);
    write({ type: 'begin' });
  } catch (error) { fail(error, 'begin'); }
  return {
    progress(kind, text) {
      if (ended) return metadata();
      const message = safeText(text);
      return write({ type: 'progress', kind: safeText(String(kind || 'info')), ...(message !== undefined ? { text: message } : {}) });
    },
    finish(result) {
      if (!ended) {
        write({ type: 'result', summary: summarizeResult(result) });
        ended = true;
        if (fd !== null) {
          try { io.closeSync(fd); fd = null; }
          catch (error) { fail(error, 'close'); }
        }
      }
      return metadata();
    },
    metadata,
  };
}

module.exports = { createMaintenanceJournal, summarizeResult };
