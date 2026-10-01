// cc-unlock for Codex — pure deploy logic (no Electron deps).
// Ports deploy.ps1's Deploy-Codex-* functions to Node. Testable / CLI-reusable.
// config.toml is manipulated with latin1 (byte passthrough) so CJK content from
// relay tools on Chinese Windows (GBK) is preserved byte-perfect — ASCII keys still regex.
'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const backup = require('./backup-core');

// ---------------- Paths ----------------
const HOME = os.homedir();
const CODEX_DIR = path.join(HOME, '.codex');
const CONFIG_PATH = path.join(CODEX_DIR, 'config.toml');
const MEMORIES_DIR = path.join(CODEX_DIR, 'memories');
const ROLLOUT_DIR = path.join(MEMORIES_DIR, 'rollout_summaries');
const SKILLS_DIR = path.join(CODEX_DIR, 'skills');
const STATE_ROOT = path.join(CODEX_DIR, '.cc-unlock-state');   // transactional backup of pre-cc-unlock state
const SESSIONS_DIR = path.join(CODEX_DIR, 'sessions');
const ARCHIVED_SESSIONS_DIR = path.join(CODEX_DIR, 'archived_sessions');
const THREAD_WRITER_LOCKS_DIR = path.join(CODEX_DIR, 'thread-writer-locks');

const APP = __dirname;                                  // cc-unlock-codex/ (or app.asar when packaged)
const MONO = path.resolve(APP, '..');                   // cc-unlock/ (dev only)
// Packaged (electron-builder): bundles are unpacked under process.resourcesPath.
// Dev / plain-node test: process.resourcesPath is undefined or lacks the bundle -> monorepo layout.
const RES = process.resourcesPath;
const PACKAGED = !!(RES && fs.existsSync(path.join(RES, 'codex-files')));
const CODEX_FILES = PACKAGED ? path.join(RES, 'codex-files') : path.join(MONO, 'codex-files');
const CONFIG_BUNDLE = path.join(CODEX_FILES, 'codex-config-bundle');   // system-prompt.md, AGENTS.md, config.toml
const MEMORY_BUNDLE = path.join(CODEX_FILES, 'codex-memory-bundle');   // memory_summary.md, MEMORY.md, raw_memories.md
const ROLLOUT_BUNDLE = path.join(CODEX_FILES, 'codex-rollout-bundle', 'rollout_summaries');
const SKILL_BUNDLE = PACKAGED ? path.join(RES, 'skill-bundle') : path.join(MONO, 'cc-unlock-files', 'skill-bundle');

const SKILL_DIRS = ['sec-forge'];
const MEMORY_FILES = []; // retained export for compatibility; no memory payloads

// v1.x/v6.x/v8.x 历史部署残留 — 每次部署前清理
const LEGACY_SKILL_FILES = ['loop-sec.md'];
const LEGACY_SKILL_DIRS = ['loop-sec', 'android-reverse', 'web-reverse', 'win-reverse'];
const INSTR_LINE = 'model_instructions_file = "system-prompt.md"';
const RELAY_HEADER = '[model_providers.cc_unlock_relay]';

const PATHS = {
  HOME, CODEX_DIR, CONFIG_PATH, MEMORIES_DIR, SKILLS_DIR,
  SESSIONS_DIR, ARCHIVED_SESSIONS_DIR, THREAD_WRITER_LOCKS_DIR,
  CODEX_FILES, CONFIG_BUNDLE, MEMORY_BUNDLE, ROLLOUT_BUNDLE, SKILL_BUNDLE,
};

const COLLABORATION_MODE_MARKERS = [
  '# collaboration mode: default',
  'you are now in default mode',
  'request_user_input availability',
  'use the request_user_input tool only when it is listed',
  'never use the request_user_input tool for permission requests',
  'never write a multiple choice question as a textual assistant message',
];

// ---------------- FS helpers ----------------
const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const ensureDir = (p) => { try { fs.mkdirSync(p, { recursive: true }); } catch {} };
const readLatin1 = (p) => fs.readFileSync(p, 'latin1');
const writeLatin1 = (p, s) => fs.writeFileSync(p, s, 'latin1');
function atomicWriteLatin1(filePath, content) {
  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temp, content, 'latin1');
    fs.renameSync(temp, filePath);
  } finally {
    try { fs.rmSync(temp, { force: true }); } catch {}
  }
}
function copyFile(src, dst) { try { fs.copyFileSync(src, dst); return true; } catch { return false; } }
function copyDir(src, dst) {
  try { if (exists(dst)) fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(src, dst, { recursive: true }); return true; }
  catch { return false; }
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); return true; } catch { return false; } }
function countFiles(dir) {
  let n = 0;
  const walk = (d) => { let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const x of e) { const fp = path.join(d, x.name); if (x.isDirectory()) walk(fp); else n++; } };
  if (exists(dir)) walk(dir);
  return n;
}

function walkFiles(dir, accept, out, failures) {
  out = out || [];
  let entries = [];
  try {
    assertRegularSessionPath(dir, 'directory');
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return out;
    if (!failures) throw err;
    failures.push({ file: dir, error: String(err && err.message || err) });
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      if (failures) failures.push({ file: full, error: '拒绝读取链接会话路径' });
    } else if (entry.isDirectory()) walkFiles(full, accept, out, failures);
    else if (entry.isFile() && accept(full)) out.push(full);
  }
  return out;
}

function normalizeInstruction(text) {
  return String(text || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/`/g, '')
    .toLowerCase();
}

function isTargetCollaborationInstruction(text) {
  if (typeof text !== 'string') return false;
  const normalized = normalizeInstruction(text);
  return COLLABORATION_MODE_MARKERS.every((marker) => normalized.includes(marker));
}

function findInstructionFieldPaths(value, objectPath, out) {
  objectPath = objectPath || '$';
  out = out || [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => findInstructionFieldPaths(item, `${objectPath}[${i}]`, out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${objectPath}.${key}`;
    if ((key === 'developer_instructions' || key === 'developerInstructions') && isTargetCollaborationInstruction(child)) out.push(childPath);
    findInstructionFieldPaths(child, childPath, out);
  }
  return out;
}

function findTargetStrings(value, objectPath, out) {
  objectPath = objectPath || '$';
  out = out || [];
  if (typeof value === 'string') {
    if (isTargetCollaborationInstruction(value)) out.push(objectPath);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => findTargetStrings(item, `${objectPath}[${i}]`, out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value)) findTargetStrings(child, `${objectPath}.${key}`, out);
  return out;
}

function matchingContextPaths(record) {
  // A quoted instruction in a user/assistant message is data, never a cleanup target.
  const message = record && record.type === 'response_item' && record.payload;
  if (message && message.type === 'message' && ['user', 'assistant'].includes(message.role)) return [];
  const paths = findInstructionFieldPaths(record);
  const payload = record && record.payload;
  if (record && record.type === 'response_item' && payload && payload.type === 'message' && payload.role === 'developer') {
    for (const p of findTargetStrings(payload.content, '$.payload.content')) if (!paths.includes(p)) paths.push(p);
  }
  return paths;
}

function sessionRoots(opts) {
  if (opts && Array.isArray(opts.roots) && opts.roots.length) return opts.roots.map((root, i) => ({ name: `root-${i}`, root: path.resolve(root) }));
  return [
    { name: 'sessions', root: SESSIONS_DIR },
    { name: 'archived_sessions', root: ARCHIVED_SESSIONS_DIR },
  ];
}

function enumerateSessionFiles(opts, failures) {
  const files = [];
  for (const item of sessionRoots(opts)) {
    try {
      for (const file of walkFiles(item.root, (p) => /^rollout-.*\.jsonl$/i.test(path.basename(p)), [], failures)) {
        files.push({ rootName: item.name, root: item.root, file });
      }
    } catch (err) {
      if (!failures) throw err;
      failures.push({ file: item.root, error: String(err && err.message || err) });
    }
  }
  return files;
}

function inspectWriterLockDirectory() {
  try {
    assertRegularSessionPath(CODEX_DIR, 'directory');
    const stat = fs.lstatSync(THREAD_WRITER_LOCKS_DIR);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('writer 锁路径不是普通目录');
    const real = fs.realpathSync(THREAD_WRITER_LOCKS_DIR);
    if (path.relative(path.join(fs.realpathSync(CODEX_DIR), 'thread-writer-locks'), real)) {
      throw new Error('writer 锁目录解析到预期路径之外');
    }
    const entries = fs.readdirSync(real, { withFileTypes: true });
    return { status: 'available', lockCount: entries.filter(e => e.isFile() && e.name.endsWith('.lock')).length };
  } catch (err) {
    if (err.code === 'ENOENT') return { status: 'missing', lockCount: 0 };
    return { status: 'unknown', lockCount: null, error: String(err && err.message || err) };
  }
}

function probeCodexProcesses() {
  const isCodex = name => /^codex(?:-(?:app-server|server|tui))?(?:\.exe)?$/i.test(path.basename(name));
  if (process.platform === 'win32') {
    if (!process.env.SystemRoot) throw new Error('缺少 SystemRoot，无法检查 Codex 进程');
    const output = execFileSync(path.join(process.env.SystemRoot, 'System32', 'tasklist.exe'), ['/FO', 'CSV', '/NH'], {
      encoding: 'utf8', timeout: 8000, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
    });
    const rows = String(output).split(/\r?\n/).map(line => line.match(/^"([^"]+)","(\d+)"/)).filter(Boolean);
    if (!rows.length) throw new Error('进程列表不可解析，无法确认写入状态');
    return rows.filter(row => isCodex(row[1])).map(row => ({ name: row[1], pid: Number(row[2]) }));
  }
  if (process.platform === 'linux' || process.platform === 'darwin') {
    const output = execFileSync('ps', ['-A', '-o', 'pid=,comm='], {
      encoding: 'utf8', timeout: 8000, maxBuffer: 8 * 1024 * 1024,
    });
    const rows = String(output).split(/\r?\n/).map(line => line.match(/^\s*(\d+)\s+(.+?)\s*$/)).filter(Boolean);
    if (!rows.length) throw new Error('进程列表不可解析，无法确认写入状态');
    return rows.filter(row => isCodex(row[2])).map(row => ({ name: path.basename(row[2]), pid: Number(row[1]) }));
  }
  throw new Error('当前平台不支持可靠的 Codex 写入状态检查');
}

function inspectCodexWriteState(opts) {
  const locks = inspectWriterLockDirectory();
  if (locks.status === 'unknown') return { status: 'unknown', reason: 'lock-directory-unreadable', locks };
  try {
    // Only direct isolated test callers can supply this probe. The worker rejects functions/options from IPC.
    const injected = opts && typeof opts.writeStateProbe === 'function' ? opts.writeStateProbe() : null;
    if (injected) {
      if (!['idle', 'active', 'unknown'].includes(injected.status)) throw new Error('写入状态探针返回非法状态');
      return { ...injected, locks };
    }
    const processes = probeCodexProcesses();
    return { status: processes.length ? 'active' : 'idle', reason: processes.length ? 'codex-process-running' : 'no-codex-process', processes, locks };
  } catch (err) {
    return { status: 'unknown', reason: 'process-check-failed', error: String(err && err.message || err), locks };
  }
}

function inspectSessionFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const matches = [];
  let invalidJsonLines = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      const paths = matchingContextPaths(record);
      if (paths.length) matches.push({ line: i + 1, ordinal: record.ordinal ?? null, recordType: record.type || null, paths });
    } catch { invalidJsonLines++; }
  }
  return { text, lines, matches, invalidJsonLines };
}

const UUID_IN_FILENAME = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig;

function segmentIdFromFile(file) {
  const ids = path.basename(file).match(UUID_IN_FILENAME) || [];
  return ids.length ? ids[ids.length - 1].toLowerCase() : null;
}

function parseRolloutLayout(file) {
  const buffer = fs.readFileSync(file);
  const records = [];
  let start = 0;
  let line = 0;
  while (start < buffer.length) {
    const lf = buffer.indexOf(0x0a, start);
    const lineEnd = lf === -1 ? buffer.length : lf;
    const bodyEnd = lineEnd > start && buffer[lineEnd - 1] === 0x0d ? lineEnd - 1 : lineEnd;
    const recordEnd = lf === -1 ? buffer.length : lf + 1;
    line++;
    const raw = buffer.subarray(start, bodyEnd).toString('utf8');
    if (raw.trim()) {
      try {
        const record = JSON.parse(raw);
        records.push({ line, start, bodyEnd, recordEnd, ordinal: record.ordinal, record });
      } catch {}
    }
    start = recordEnd;
  }
  return { file, buffer, records };
}

function writeRecordAtSameLength(layout, entry, record) {
  const encoded = Buffer.from(JSON.stringify(record), 'utf8');
  const available = entry.bodyEnd - entry.start;
  if (encoded.length > available) throw new Error(`修复后的 session_meta 超出原行长度: ${encoded.length} > ${available}`);
  const output = Buffer.from(layout.buffer);
  output.fill(0x20, entry.start, entry.bodyEnd);
  encoded.copy(output, entry.start);
  if (output.length !== layout.buffer.length) throw new Error('修复后 rollout 长度发生变化');
  const temp = `${layout.file}.cc-unlock-repair-${process.pid}.tmp`;
  fs.writeFileSync(temp, output);
  try { fs.copyFileSync(temp, layout.file); }
  finally { try { fs.rmSync(temp, { force: true }); } catch {} }
}

function repairPaginatedLineages(opts, log) {
  const result = { checked: 0, mismatches: 0, fixed: 0, skippedActive: [], missingSources: [], failures: [], fixes: [] };
  const files = enumerateSessionFiles(opts, result.failures);
  const layouts = new Map();
  const metadata = [];

  for (const item of files) {
    try {
      const layout = parseRolloutLayout(item.file);
      const segmentId = segmentIdFromFile(item.file);
      if (segmentId && !layouts.has(segmentId)) layouts.set(segmentId, layout);
      metadata.push({ item, layout, segmentId, sessionMeta: layout.records[0] });
    } catch (err) {
      result.failures.push({ file: item.file, error: String(err && err.message || err) });
    }
  }

  for (const child of metadata) {
    const historyBase = child.sessionMeta && child.sessionMeta.record && child.sessionMeta.record.payload && child.sessionMeta.record.payload.history_base;
    if (!historyBase) continue;
    result.checked++;
    const source = layouts.get(String(historyBase.thread_id || '').toLowerCase());
    if (!source) {
      result.missingSources.push({ child: child.item.file, sourceSegment: historyBase.thread_id });
      continue;
    }
    const boundary = source.records.find((entry) => Number.isFinite(entry.ordinal) && entry.ordinal >= historyBase.end_ordinal_exclusive);
    const expected = boundary ? boundary.start : source.buffer.length;
    if (expected === historyBase.end_byte_offset) continue;
    result.mismatches++;
    const writeState = inspectCodexWriteState(opts);
    if (writeState.status !== 'idle') {
      result.skippedActive.push(child.item.file);
      result.blockedReason = writeState.reason || writeState.status;
      if (log) log('warn', 'Codex 正在运行或写入状态未知，已停止 lineage 修复');
      continue;
    }
    try {
      const oldOffset = historyBase.end_byte_offset;
      historyBase.end_byte_offset = expected;
      writeRecordAtSameLength(child.layout, child.sessionMeta, child.sessionMeta.record);
      result.fixed++;
      result.fixes.push({ child: child.item.file, source: source.file, oldOffset, newOffset: expected, endOrdinalExclusive: historyBase.end_ordinal_exclusive });
      if (log) log('ok', `${path.basename(child.item.file)}: lineage ${oldOffset} -> ${expected}`);
    } catch (err) {
      result.failures.push({ file: child.item.file, error: String(err && err.message || err) });
      if (log) log('fail', `${child.item.file}: ${err.message}`);
    }
  }
  return result;
}

function scanInjectedContext(opts, log) {
  const summary = { filesScanned: 0, filesWithMatches: 0, recordsMatched: 0, invalidJsonLines: 0, failures: [], files: [] };
  const files = enumerateSessionFiles(opts, summary.failures);
  if (log) log('head', '历史指令片段扫描（只读）');
  for (const item of files) {
    try {
      const info = inspectSessionFile(item.file);
      summary.filesScanned++;
      summary.invalidJsonLines += info.invalidJsonLines;
      if (info.matches.length) {
        summary.filesWithMatches++;
        summary.recordsMatched += info.matches.length;
        summary.files.push({ file: item.file, recordsMatched: info.matches.length, matches: info.matches });
      }
    } catch (err) {
      summary.failures.push({ file: item.file, error: String(err && err.message || err) });
    }
  }
  if (log) {
    log(summary.recordsMatched ? 'warn' : 'ok', `扫描 ${summary.filesScanned} 个会话文件，命中 ${summary.filesWithMatches} 个文件 / ${summary.recordsMatched} 条记录`);
    if (summary.invalidJsonLines) log('warn', `保留无法解析的 JSONL 行: ${summary.invalidJsonLines}`);
    for (const failure of summary.failures) log('fail', `${failure.file}: ${failure.error}`);
  }
  summary.ok = !summary.failures.length;
  summary.status = summary.ok ? 'scanned' : 'partial';
  return summary;
}

function replaceTargetStrings(value) {
  if (typeof value === 'string') return isTargetCollaborationInstruction(value) ? { value: '', changed: 1 } : { value, changed: 0 };
  if (Array.isArray(value)) {
    let changed = 0;
    const output = value.map((item) => {
      const result = replaceTargetStrings(item);
      changed += result.changed;
      return result.value;
    });
    return { value: output, changed };
  }
  if (!value || typeof value !== 'object') return { value, changed: 0 };
  let changed = 0;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    const result = replaceTargetStrings(child);
    changed += result.changed;
    output[key] = result.value;
  }
  return { value: output, changed };
}

function neutralizeContextRecord(record) {
  let changed = 0;
  function walk(value) {
    if (Array.isArray(value)) { for (const item of value) walk(item); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if ((key === 'developer_instructions' || key === 'developerInstructions') && isTargetCollaborationInstruction(child)) {
        value[key] = null;
        changed++;
      } else {
        walk(child);
      }
    }
  }
  walk(record);

  const payload = record && record.payload;
  if (record && record.type === 'response_item' && payload && payload.type === 'message' && payload.role === 'developer') {
    const result = replaceTargetStrings(payload.content);
    if (result.changed) {
      payload.content = result.value;
      changed += result.changed;
    }
  }
  return changed;
}

// Locate JSON string tokens by byte offsets so unrelated bytes on the same row stay intact.
function contextStringSpans(body, record) {
  const spans = [];
  const developerMessage = record.type === 'response_item' && record.payload
    && record.payload.type === 'message' && record.payload.role === 'developer';
  let pos = 0;
  const space = () => { while (pos < body.length && [9, 10, 13, 32].includes(body[pos])) pos++; };
  function stringToken() {
    const start = pos++;
    while (pos < body.length) {
      if (body[pos] === 0x5c) { pos += 2; continue; }
      if (body[pos++] === 0x22) return { start, end: pos, value: JSON.parse(body.subarray(start, pos).toString('utf8')) };
    }
    throw new Error('JSON string token 未结束');
  }
  function value(keys) {
    space();
    if (body[pos] === 0x22) {
      const token = stringToken();
      const key = keys[keys.length - 1];
      const instructionField = key === 'developer_instructions' || key === 'developerInstructions';
      const developerContent = developerMessage && keys[0] === 'payload' && keys[1] === 'content';
      if ((instructionField || developerContent) && isTargetCollaborationInstruction(token.value)) {
        spans.push({ ...token, replacement: instructionField ? 'null' : '""' });
      }
    } else if (body[pos] === 0x7b) {
      pos++; space();
      if (body[pos] === 0x7d) { pos++; return; }
      while (pos < body.length) {
        space(); const key = stringToken().value; space(); pos++; // colon, already validated by JSON.parse
        value([...keys, key]); space();
        if (body[pos++] === 0x7d) break;
      }
    } else if (body[pos] === 0x5b) {
      pos++; space();
      if (body[pos] === 0x5d) { pos++; return; }
      let index = 0;
      while (pos < body.length) {
        value([...keys, index++]); space();
        if (body[pos++] === 0x5d) break;
      }
    } else {
      while (pos < body.length && ![9, 10, 13, 32, 0x2c, 0x5d, 0x7d].includes(body[pos])) pos++;
    }
  }
  value([]);
  return spans;
}

function neutralizeSessionBuffer(buffer) {
  const matches = [], failures = [];
  let invalidJsonLines = 0, start = 0, lineNumber = 0;
  while (start < buffer.length) {
    const lf = buffer.indexOf(0x0a, start);
    const lineEnd = lf === -1 ? buffer.length : lf;
    const bodyEnd = lineEnd > start && buffer[lineEnd - 1] === 0x0d ? lineEnd - 1 : lineEnd;
    const eolEnd = lf === -1 ? buffer.length : lf + 1;
    const body = buffer.subarray(start, bodyEnd);
    lineNumber++;
    if (body.length && body.toString('utf8').trim()) {
      let record;
      try { record = JSON.parse(body.toString('utf8')); }
      catch { invalidJsonLines++; }
      if (record) {
        const paths = matchingContextPaths(record);
        if (paths.length) {
          try {
            const spans = contextStringSpans(body, record);
            const replacement = Buffer.from(body);
            for (const span of spans) {
              const literal = Buffer.from(span.replacement, 'utf8');
              if (literal.length > span.end - span.start) throw new Error('replacement-longer-than-source');
              replacement.fill(0x20, span.start, span.end);
              literal.copy(replacement, span.start);
            }
            if (!spans.length || matchingContextPaths(JSON.parse(replacement.toString('utf8'))).length) throw new Error('target-not-neutralized');
            matches.push({ line: lineNumber, start, bodyEnd, eolEnd, replacement,
              spans: spans.map(span => ({ start: start + span.start, end: start + span.end,
                original: Buffer.from(body.subarray(span.start, span.end)),
                replacement: Buffer.from(replacement.subarray(span.start, span.end)) })),
              ordinal: record.ordinal ?? null, recordType: record.type || null, paths, neutralizedFields: spans.length });
          } catch (err) { failures.push({ line: lineNumber, reason: String(err && err.message || err) }); }
        }
      }
    }
    start = eolEnd;
  }
  return { matches, failures, invalidJsonLines };
}

function changedDuringCleanup(message) {
  return Object.assign(new Error(message), { code: 'CC_CONTEXT_CHANGED' });
}

function assertRegularSessionPath(file, finalKind = 'file') {
  const absolute = path.resolve(file);
  const root = path.parse(absolute).root;
  let current = root;
  const parts = absolute.slice(root.length).split(path.sep).filter(Boolean);
  let stat;
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('拒绝修改链接会话路径');
    const directory = index < parts.length - 1 || finalKind === 'directory';
    if (directory ? !stat.isDirectory() : !stat.isFile()) throw new Error('会话路径不是普通文件或目录');
  }
  // Hard-linked records may also be reachable from an unrelated directory.
  if (finalKind === 'file' && stat && stat.nlink > 1) throw new Error('拒绝修改多硬链接会话文件');
  return stat;
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function readDescriptorExactly(fd, length, position) {
  const output = Buffer.alloc(length);
  let offset = 0;
  while (offset < length) {
    const read = fs.readSync(fd, output, offset, length - offset, position + offset);
    if (!read) throw changedDuringCleanup('会话在读取时截短');
    offset += read;
  }
  return output;
}

function assertExpectedPrefix(fd, expected, end) {
  const chunk = 64 * 1024;
  for (let position = 0; position < end; position += chunk) {
    const size = Math.min(chunk, end - position);
    if (!readDescriptorExactly(fd, size, position).equals(expected.subarray(position, position + size))) {
      throw changedDuringCleanup('目标行或其前缀在提交前变化');
    }
  }
}

function assertDescriptorStillNamed(fd, file, minimumSize) {
  const current = fs.fstatSync(fd), named = assertRegularSessionPath(file);
  if (!sameFileIdentity(current, named) || current.size < minimumSize) throw changedDuringCleanup('会话被替换或截短');
  return current;
}

function recordUncertainContextWrite(summary, state, err) {
  const detail = {
    file: state.file, line: state.line, offset: state.offset, length: state.original.length,
    phase: state.phase, bytesWritten: state.bytesWritten,
    reason: String(err && err.message || err), rollbackStatus: state.rollbackStatus || 'not-attempted',
  };
  summary.uncertainWrites.push(detail);
  summary.uncertainWriteCount = summary.uncertainWrites.length;
  summary.filesPossiblyChanged = new Set(summary.uncertainWrites.map(write => write.file)).size;
}

function tryRollbackShortToken(fd, state, minimumSize, summary) {
  const event = { file: state.file, line: state.line, offset: state.offset, length: state.original.length };
  try {
    assertDescriptorStillNamed(fd, state.file, minimumSize);
    const partial = Buffer.from(state.original);
    state.replacement.copy(partial, 0, 0, state.bytesWritten);
    const actual = readDescriptorExactly(fd, partial.length, state.offset);
    if (!actual.equals(partial)) {
      state.rollbackStatus = 'refused-concurrent-token-change';
      summary.rollbacks.refused++;
      event.status = state.rollbackStatus;
      return false;
    }
    // Only the exact token is restored. Unrelated fields or concurrent appended records
    // are never written; the token comparison remains optimistic, not a cross-process CAS.
    state.rollbackStatus = 'attempted';
    let writeError;
    try { event.bytesWritten = fs.writeSync(fd, state.original, 0, state.original.length, state.offset); }
    catch (err) { writeError = err; event.writeError = String(err && err.message || err); }
    const restored = readDescriptorExactly(fd, state.original.length, state.offset);
    assertDescriptorStillNamed(fd, state.file, minimumSize);
    if (!restored.equals(state.original)) throw writeError || new Error('token 回滚后字节不一致');
    state.rollbackStatus = 'verified';
    summary.rollbacks.verified++;
    event.status = 'verified';
    return true;
  } catch (err) {
    state.rollbackStatus = 'unverified';
    summary.rollbacks.unverified++;
    event.status = 'unverified';
    event.error = String(err && err.message || err);
    return false;
  } finally {
    summary.rollbacks.events.push(event);
  }
}

function patchSessionContext(item, summary, log) {
  let fd, completedRecords = 0, partialRecords = 0, confirmedFields = 0, pendingWrite = null;
  try {
    const before = assertRegularSessionPath(item.file);
    // No O_TRUNC/O_APPEND. The descriptor and named file are compared before every
    // token write; only immutable-length target token bytes are ever overwritten.
    fd = fs.openSync(item.file, fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW || 0));
    const opened = fs.fstatSync(fd);
    if (!sameFileIdentity(before, opened) || !opened.isFile()) throw changedDuringCleanup('会话文件在打开时被替换');
    const expected = readDescriptorExactly(fd, opened.size, 0);
    const info = neutralizeSessionBuffer(expected);
    summary.filesScanned++;
    summary.invalidJsonLines += info.invalidJsonLines;
    summary.failures.push(...info.failures.map(failure => ({ file: item.file, ...failure })));
    for (const match of info.matches) {
      let confirmedInRecord = 0;
      try {
        for (const span of match.spans) {
          const current = assertDescriptorStillNamed(fd, item.file, expected.length);
          assertExpectedPrefix(fd, expected, match.eolEnd);
          // Do not edit a last unterminated record that is still being appended to.
          if (match.eolEnd === expected.length && expected[expected.length - 1] !== 0x0a && current.size > expected.length) {
            throw changedDuringCleanup('未换行的目标尾行仍在增长');
          }
          pendingWrite = { file: item.file, line: match.line, offset: span.start,
            original: span.original, replacement: span.replacement, bytesWritten: null, phase: 'write', rollbackStatus: 'not-attempted' };
          const size = fs.writeSync(fd, span.replacement, 0, span.replacement.length, span.start);
          pendingWrite.bytesWritten = size;
          if (size > 0) summary.transientWritesOccurred = true;
          if (size !== span.replacement.length) {
            const error = new Error('目标 token 短写，未计为成功');
            pendingWrite.phase = 'short-write';
            if (Number.isInteger(size) && size >= 0 && size < span.original.length) {
              if (tryRollbackShortToken(fd, pendingWrite, expected.length, summary)) pendingWrite = null;
            }
            throw error;
          }
          pendingWrite.phase = 'verify';
          const actual = readDescriptorExactly(fd, span.replacement.length, span.start);
          if (!actual.equals(span.replacement)) throw changedDuringCleanup('目标 token 在写入后被并发修改');
          assertDescriptorStillNamed(fd, item.file, expected.length);
          span.replacement.copy(expected, span.start);
          confirmedInRecord++;
          confirmedFields++;
          pendingWrite = null;
        }
        completedRecords++;
      } finally {
        if (confirmedInRecord && confirmedInRecord < match.spans.length) partialRecords++;
      }
    }
  } catch (err) {
    if (pendingWrite) {
      // A thrown write does not say whether data changed. A single guarded observation
      // can establish unchanged bytes; successful writes with failed verification stay uncertain.
      let observedUnchanged = false;
      if (pendingWrite.phase === 'write') {
        try {
          const actual = readDescriptorExactly(fd, pendingWrite.original.length, pendingWrite.offset);
          assertDescriptorStillNamed(fd, item.file, pendingWrite.offset + pendingWrite.original.length);
          observedUnchanged = actual.equals(pendingWrite.original);
        } catch {}
      }
      if (!observedUnchanged) recordUncertainContextWrite(summary, pendingWrite, err);
    }
    if (err.code === 'CC_CONTEXT_CHANGED') {
      summary.skippedChangedDuringScan.push(item.file);
      if (log) log('warn', `${path.basename(item.file)}: ${err.message}；保留其余字段并继续其他文件`);
    } else {
      summary.failures.push({ file: item.file, error: String(err && err.message || err) });
      if (log) log('fail', `${item.file}: ${err.message}`);
    }
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); }
      catch (err) { summary.failures.push({ file: item.file, error: `关闭会话句柄: ${err.message}` }); }
    }
    summary.recordsPartiallyNeutralized += partialRecords;
    summary.recordsNeutralized += completedRecords;
    summary.fieldsNeutralized += confirmedFields;
    const uncertainWrites = summary.uncertainWrites.filter(write => write.file === item.file).length;
    if (confirmedFields) summary.filesChanged++;
    if (confirmedFields || uncertainWrites) {
      summary.files.push({ file: item.file, recordsNeutralized: completedRecords,
        recordsPartiallyNeutralized: partialRecords, fieldsNeutralized: confirmedFields, uncertainWrites });
    }
    if (confirmedFields && log) log('ok', `${path.basename(item.file)}: 已读回确认 ${confirmedFields} 个目标字段；完整清理 ${completedRecords} 条历史片段`);
    if (uncertainWrites && log) log('warn', `${path.basename(item.file)}: ${uncertainWrites} 次写入结果未确认；可能已修改磁盘，请重新载入并检查此文件`);
  }
}

function clearThreadWriterLocks(log) {
  const root = path.resolve(THREAD_WRITER_LOCKS_DIR);
  const result = { removed: [], failures: [] };
  const inside = (base, file) => {
    const relative = path.relative(base, file);
    return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`);
  };
  const fail = (file, stage, err) => {
    // A vanished entry was not deleted by this call and must not inflate the count.
    if (err.code !== 'ENOENT') result.failures.push({ file, stage,
      code: err.code || null, error: String(err && err.message || err) });
  };
  let stage = 'validate-root';
  try {
    assertRegularSessionPath(root, 'directory');
    const realRoot = fs.realpathSync(root);
    if (path.relative(path.join(fs.realpathSync(CODEX_DIR), 'thread-writer-locks'), realRoot)) {
      throw new Error('writer 锁目录解析到预期路径之外');
    }
    const validateDirectory = dir => {
      assertRegularSessionPath(dir, 'directory');
      if (!inside(root, dir) || !inside(realRoot, fs.realpathSync(dir))) {
        throw new Error('拒绝遍历 writer 锁目录外部路径');
      }
    };
    function walk(dir) {
      let entries, walkStage = 'validate-directory';
      try {
        validateDirectory(dir);
        walkStage = 'enumerate-directory';
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (err) { fail(dir, walkStage, err); return; }
      for (const entry of entries) {
        const file = path.resolve(dir, entry.name);
        let entryStage = 'validate-entry';
        try {
          if (file === root || path.dirname(file) !== dir || !inside(root, file)) {
            throw new Error('拒绝删除 writer 锁目录外部文件');
          }
          // Revalidate every parent before acting; a stale directory entry must
          // never authorize traversing an ancestor replaced by a junction.
          entryStage = 'validate-parent';
          validateDirectory(dir);
          if (entry.isDirectory() && !entry.isSymbolicLink()) { walk(file); continue; }
          if (!entry.isFile() && !entry.isSymbolicLink()) {
            entryStage = 'validate-entry';
            throw new Error('writer 锁目录存在不支持的文件类型');
          }
          // Dirent already supplies the kind; basename deletion needs no
          // separate per-file stat. Native pending status is classified below.
          // unlink never follows a link, never recurses, and cannot remove a
          // regular directory if the entry changes after enumeration.
          entryStage = 'unlink';
          fs.unlinkSync(file);
          result.removed.push(file);
        } catch (err) { fail(file, entryStage, err); }
      }
    }
    stage = 'walk';
    walk(root);
  } catch (err) { fail(root, stage, err); }
  result.pendingDeletion = [];
  const possiblePending = result.failures.filter(failure => failure.stage === 'unlink' && ['EPERM', 'EACCES', 'EBUSY'].includes(failure.code));
  if (possiblePending.length) {
    try {
      const probe = require('./lock-delete-state').probeLockDeleteState(possiblePending.map(failure => failure.file));
      const verified = new Map((probe.results || []).filter(item => item.status === 'delete-pending').map(item => [item.file, item]));
      // EPERM alone never proves deletion. Only an observed native DELETE_PENDING
      // status can move an entry out of the genuine-failure list.
      result.pendingDeletion = possiblePending.filter(item => verified.has(item.file)).map(item => ({ ...item, ntstatus: verified.get(item.file).ntstatus }));
      result.failures = result.failures.filter(item => !verified.has(item.file));
      if (probe.failures?.length) result.stateProbeFailures = probe.failures;
    } catch (err) { result.stateProbeFailures = [{ error: String(err && err.message || err) }]; }
  }
  if (log) {
    log(result.failures.length || result.pendingDeletion.length ? 'warn' : 'ok', `已删除 ${result.removed.length} 个 writer 锁目录内文件，${result.pendingDeletion.length} 个已标记删除、等待句柄释放（目录保留）`);
    for (const pending of result.pendingDeletion) log('warn', `${pending.file}: [${pending.ntstatus}] 已标记删除，等待现有句柄释放；不计为删除成功或失败`);
    for (const failure of result.failures) log('fail', `${failure.file}: [${failure.stage}/${failure.code || 'ERROR'}] ${failure.error}`);
  }
  return result;
}

function cleanInjectedContext(opts, log) {
  opts = opts || {};
  const summary = {
    ok: false, status: 'partial', filesScanned: 0, filesEnumerated: 0, scanStarted: false, scanCompleted: false, contextStatus: 'not-started', contextFailures: [], filesChanged: 0, recordsNeutralized: 0, fieldsNeutralized: 0,
    invalidJsonLines: 0, skippedChangedDuringScan: [], failures: [], files: [],
    filesPossiblyChanged: 0, uncertainWriteCount: 0, uncertainWrites: [], recordsPartiallyNeutralized: 0,
    transientWritesOccurred: false, rollbacks: { verified: 0, unverified: 0, refused: 0, events: [] },
    lineageRepair: { enabled: false, fixed: 0, failures: [], skipped: opts.repairLineage ? 'disabled-during-context-cleanup' : 'not-requested' },
    projectionReset: { removed: [], failures: [], skipped: 'automatic-reset-disabled' },
    threadWriterLocks: { removed: [], failures: [], pendingDeletion: [], skipped: opts.roots ? 'custom-roots' : 'not-requested' },
    requiresReload: false, diskOnly: true, currentContextUpdated: false,
    liveContextWarning: '只修改磁盘中的匹配历史字段；不会清除当前任务已载入的内存上下文。',
  };
  if (log) log('head', '一键清理历史指令片段（无需退出 Codex）');
  summary.writeState = { status: 'not-checked', reason: 'unconditional-lock-cleanup' };
  // The explicit one-click action clears every file in the current user's lock folder
  // first. Process state is informational only; path boundaries remain mandatory.
  if (opts.clearStaleLocks === true && !opts.roots) {
    summary.threadWriterLocks = clearThreadWriterLocks(log);
    summary.failures.push(...summary.threadWriterLocks.failures);
    if (summary.threadWriterLocks.failures.length && log) log('warn', 'writer 锁目录清理不完整；继续清理可修改的历史字段。');
  }
  const lockFailureCount = summary.failures.length;
  summary.scanStarted = true;
  const files = enumerateSessionFiles(opts, summary.failures);
  summary.filesEnumerated = files.length;
  if (log) log('info', `默认遍历 sessions 和 archived_sessions：枚举 ${files.length} 个历史文件`);
  for (const item of files) {
    patchSessionContext(item, summary, log);
    if (log && summary.filesScanned && summary.filesScanned % 50 === 0) log('info', `已处理 ${summary.filesScanned} / ${files.length} 个历史文件`);
  }
  summary.scanCompleted = true;
  summary.contextFailures = summary.failures.slice(lockFailureCount);
  const contextIncomplete = summary.contextFailures.length || summary.skippedChangedDuringScan.length || summary.uncertainWriteCount;
  summary.contextStatus = contextIncomplete ? 'partial' : (summary.fieldsNeutralized ? 'cleaned' : 'no-match');
  summary.requiresReload = !!(summary.filesChanged || summary.filesPossiblyChanged || summary.transientWritesOccurred);
  summary.ok = !summary.failures.length && !summary.skippedChangedDuringScan.length && !summary.uncertainWriteCount;
  summary.status = summary.ok ? (summary.requiresReload ? 'cleaned' : 'no-match') : 'partial';
  if (log) {
    log(summary.ok ? 'done' : 'warn', `${summary.ok ? '完成' : '未完整完成'}: 历史遍历 ${summary.filesScanned}/${summary.filesEnumerated} 个文件；删除 writer 锁目录文件 ${summary.threadWriterLocks.removed.length} 个，等待删除 ${summary.threadWriterLocks.pendingDeletion?.length || 0} 个；清理历史片段 ${summary.recordsNeutralized} 条 / ${summary.fieldsNeutralized} 个字段，确认修改文件 ${summary.filesChanged} 个，结果未确认 ${summary.uncertainWriteCount} 次 / ${summary.filesPossiblyChanged} 个文件。`);
    if (summary.requiresReload) log('info', `${summary.liveContextWarning} 已打开的任务需重新载入才可能使用新历史。`);
  }
  return summary;
}

// ---------------- config.toml (latin1 byte-safe) ----------------
function setInstructionsFile(cfgPath, log) {
  if (!exists(cfgPath)) { atomicWriteLatin1(cfgPath, INSTR_LINE + '\n'); return true; }
  const text = readLatin1(cfgPath);
  const lines = text.split(/(?<=\n)/);
  const tableIndex = lines.findIndex((line) => line.replace(/^\s+/, '').startsWith('['));
  const end = tableIndex < 0 ? lines.length : tableIndex;
  const indexes = [];
  for (let i = 0; i < end; i++) if (/^\s*model_instructions_file\s*=/.test(lines[i])) indexes.push(i);
  if (indexes.length && /^\s*model_instructions_file\s*=\s*"system-prompt\.md"/.test(lines[indexes[0]])) return true;

  let content;
  if (indexes.length) {
    const first = indexes[0];
    const newline = lines[first].endsWith('\r\n') ? '\r\n' : lines[first].endsWith('\n') ? '\n' : '';
    lines[first] = INSTR_LINE + newline;
    for (const i of indexes.slice(1).reverse()) lines.splice(i, 1);
    content = lines.join('');
  } else {
    const insertAt = end;
    const newline = lines.some((line) => line.endsWith('\r\n')) ? '\r\n' : '\n';
    lines.splice(insertAt, 0, INSTR_LINE + newline);
    content = lines.join('');
  }
  atomicWriteLatin1(cfgPath, content.endsWith('\n') ? content : content + '\n');
  return true;
}

function removeInstructionsFile(cfgPath) {
  if (!exists(cfgPath)) return 'absent';
  const text = readLatin1(cfgPath);
  const lines = text.split(/(?<=\n)/);
  const tableIndex = lines.findIndex((line) => line.replace(/^\s+/, '').startsWith('['));
  const end = tableIndex < 0 ? lines.length : tableIndex;
  const kept = lines.filter((line, i) => i >= end || !/^\s*model_instructions_file\s*=/.test(line));
  const joined = kept.join('').replace(/^(?:\r?\n)+/, '');
  // if file now has only whitespace, remove it entirely
  if (!joined.trim()) { rmrf(cfgPath); return 'removed'; }
  atomicWriteLatin1(cfgPath, joined.endsWith('\n') ? joined : joined + '\n');
  return 'kept';
}

function deployRelayProvider(cfgPath, apiUrl, apiKey, model) {
  if (!exists(cfgPath)) writeLatin1(cfgPath, '');
  const text = readLatin1(cfgPath);
  const lines = text.split(/\r?\n/);
  const kept = [];
  let skip = false;
  for (const l of lines) {
    if (/^\[model_providers\.cc_unlock_relay\]/.test(l)) { skip = true; continue; }
    if (skip && /^\[/.test(l)) skip = false;
    if (!skip) kept.push(l);
  }
  const block = ['', RELAY_HEADER, 'name = "cc-unlock Relay"', `base_url = "${apiUrl}"`, 'wire_api = "responses"', 'requires_openai_auth = false'];
  if (apiKey) block.push(`api_key = "${apiKey}"`);
  if (model) block.push(`model = "${model}"`);
  const content = kept.join('\n').replace(/\n+$/, '') + '\n' + block.join('\n') + '\n';
  atomicWriteLatin1(cfgPath, content);
}

function removeRelayProvider(cfgPath) {
  if (!exists(cfgPath)) return;
  const text = readLatin1(cfgPath);
  if (!text.includes(RELAY_HEADER)) return;
  const lines = text.split(/\r?\n/);
  const kept = [];
  let skip = false;
  for (const l of lines) {
    if (/^\[model_providers\.cc_unlock_relay\]/.test(l)) { skip = true; continue; }
    if (skip && /^\[/.test(l)) skip = false;
    if (!skip) kept.push(l);
  }
  let content = kept.join('\n');
  if (!content.endsWith('\n')) content += '\n';
  atomicWriteLatin1(cfgPath, content);
}

// ---------------- Deploy ----------------
function deployCodex(opts, log) {
  opts = opts || {};
  ensureDir(CODEX_DIR);
  log('head', 'Codex 配置');

  // 0. 备份原始状态一次（首次部署保留真正的 pre-cc-unlock 配置，之后可一键恢复）
  for (const f of [CONFIG_PATH, path.join(CODEX_DIR, 'AGENTS.md'), path.join(CODEX_DIR, 'system-prompt.md')]) {
    if (backup.saveOnce(STATE_ROOT, f)) log('info', `已备份原始 ${path.basename(f)}`);
  }

  // 0.5 清理历史部署残留(旧 skill)——老版本文件与新版并存会污染当前会话上下文
  {
    let legacyCleared = 0;
    for (const f of LEGACY_SKILL_FILES) if (rmrf(path.join(SKILLS_DIR, f))) legacyCleared++;
    for (const d of LEGACY_SKILL_DIRS) if (rmrf(path.join(SKILLS_DIR, d))) legacyCleared++;
    if (legacyCleared > 0) log('info', `清理历史残留: ${legacyCleared} 项`);
  }

  // 1. system-prompt.md — 人格 base（由 config.toml 的 model_instructions_file 指向，替换内置 base）
  const sp = path.join(CONFIG_BUNDLE, 'system-prompt.md');
  if (exists(sp) && copyFile(sp, path.join(CODEX_DIR, 'system-prompt.md')))
    log('ok', `system-prompt.md (${fs.statSync(path.join(CODEX_DIR, 'system-prompt.md')).size} bytes) — 人格 base`);

  // 2. AGENTS.md — 叠加在 base 之上的冗余人格层（全局用户指令）
  const ag = path.join(CONFIG_BUNDLE, 'AGENTS.md');
  if (exists(ag) && copyFile(ag, path.join(CODEX_DIR, 'AGENTS.md')))
    log('ok', `AGENTS.md (${fs.statSync(path.join(CODEX_DIR, 'AGENTS.md')).size} bytes) — 冗余人格层`);

  // 3. config.toml — model_instructions_file = "system-prompt.md" 合并写入（latin1 字节安全，保留其它键）
  if (setInstructionsFile(CONFIG_PATH, log)) log('ok', 'config.toml — model_instructions_file (merged)');

  // 4. relay provider (optional)
  if (opts.relayUrl) {
    deployRelayProvider(CONFIG_PATH, opts.relayUrl, opts.relayKey, opts.relayModel);
    log('ok', `relay provider: ${opts.relayUrl}`);
  }

  // Personal memories and transcript summaries are not deployment payloads.
  // 7. skills
  ensureDir(SKILLS_DIR);
  for (const d of SKILL_DIRS) {
    const s = path.join(SKILL_BUNDLE, d);
    if (exists(s) && copyDir(s, path.join(SKILLS_DIR, d))) log('ok', `skills/${d}/ (${countFiles(path.join(SKILLS_DIR, d))} files)`);
  }
}

function uninstallCodex(log) {
  if (!exists(CODEX_DIR)) { log('warn', '~/.codex 不存在'); return; }
  log('head', 'Codex 卸载');
  for (const f of ['system-prompt.md', 'AGENTS.md']) if (rmrf(path.join(CODEX_DIR, f))) log('ok', `removed ${f}`);
  removeRelayProvider(CONFIG_PATH);
  switch (removeInstructionsFile(CONFIG_PATH)) {
    case 'removed': log('ok', 'removed config.toml'); break;
    case 'kept': log('info', 'config.toml (保留其它设置)'); break;
  }
  for (const d of SKILL_DIRS) rmrf(path.join(SKILLS_DIR, d));
  log('ok', 'removed prompt/config + skills; memories untouched');
}

function verifyCodex(log) {
  log('head', 'Codex 验证');
  const sp = path.join(CODEX_DIR, 'system-prompt.md');
  log(exists(sp) ? 'ok' : 'fail', `system-prompt.md ${exists(sp) ? `(${fs.statSync(sp).size} b) — 人格 base` : 'MISSING'}`);
  const cfgOk = exists(CONFIG_PATH) && /model_instructions_file\s*=\s*"system-prompt\.md"/.test(readLatin1(CONFIG_PATH));
  log(cfgOk ? 'ok' : 'fail', `config.toml — model_instructions_file ${cfgOk ? '(= system-prompt.md)' : 'MISSING（1.0 部署必须有）'}`);
  const ag = path.join(CODEX_DIR, 'AGENTS.md');
  log(exists(ag) ? 'ok' : 'warn', `AGENTS.md ${exists(ag) ? `(${fs.statSync(ag).size} b) — 冗余人格层` : 'MISSING'}`);
  const sOk = SKILL_DIRS.filter((d) => exists(path.join(SKILLS_DIR, d))).length;
  log(sOk === SKILL_DIRS.length ? 'ok' : 'warn', `skills ${sOk}/${SKILL_DIRS.length}`);
}

// ---------------- Restore (one-click put ~/.codex back to pre-cc-unlock state) ----------------
function restoreOriginal(log) {
  log('head', '恢复原始 Codex 配置');
  if (!backup.hasState(STATE_ROOT)) { log('warn', '没有备份记录（cc-unlock 未部署过，或备份已清除）'); return { ok: false, results: [] }; }
  const results = [CONFIG_PATH, path.join(CODEX_DIR, 'AGENTS.md'), path.join(CODEX_DIR, 'system-prompt.md')].map(p => {
    try { const action = backup.restore(STATE_ROOT, p); log('info', `${action}: ${p}`); return { path: p, action }; }
    catch (error) { log('fail', error.message); return { path: p, action: 'fail', error: error.message }; }
  });
  // cc-unlock 新增的目录/文件（部署前不存在的）一并清掉，回到干净状态
  for (const d of SKILL_DIRS) rmrf(path.join(SKILLS_DIR, d));
  log('done', '已恢复到部署前状态。请重启 Codex。');
  return { ok: true, results };
}

// ---------------- Detection ----------------
function detectVersion() {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const bin = isWin ? 'cmd' : 'codex';
    const args = isWin ? ['/c', 'codex', '--version'] : ['--version'];
    try {
      execFile(bin, args, { timeout: 4000, windowsHide: true }, (err, out) => {
        if (err || !out) return resolve(null);
        const m = String(out).match(/(\d+\.\d+\.\d+)/);
        resolve(m ? m[1] : String(out).trim().slice(0, 20));
      });
    } catch { resolve(null); }
  });
}

async function detect() {
  const relay = exists(CONFIG_PATH) && readLatin1(CONFIG_PATH).includes(RELAY_HEADER);
  const cfgInstr = exists(CONFIG_PATH) && /model_instructions_file\s*=\s*"system-prompt\.md"/.test(readLatin1(CONFIG_PATH));
  const liveSp = exists(path.join(CODEX_DIR, 'system-prompt.md'));
  const liveAgents = exists(path.join(CODEX_DIR, 'AGENTS.md'));
  return {
    codexInstalled: exists(CODEX_DIR),
    codexVersion: (await detectVersion()) || '?',
    configPresent: exists(CONFIG_PATH),
    cfgInstr,                      // true = config.toml 有 model_instructions_file = "system-prompt.md"
    deployed: liveSp && cfgInstr,  // system-prompt.md 就位 + config 指向它 = 已部署
    hasBackup: backup.hasState(STATE_ROOT),
    relayConfigured: relay,
    spBundle: exists(path.join(CONFIG_BUNDLE, 'system-prompt.md')),
    agentsBundle: exists(path.join(CONFIG_BUNDLE, 'AGENTS.md')),
    memFiles: MEMORY_FILES.filter((f) => exists(path.join(MEMORY_BUNDLE, f))).length,
    rolloutFiles: 0,
    skillDirs: SKILL_DIRS.filter((d) => exists(path.join(SKILL_BUNDLE, d))).length,
    // live status
    liveSp, liveAgents,
    liveMem: MEMORY_FILES.filter((f) => exists(path.join(MEMORIES_DIR, f))).length,
    liveSkills: SKILL_DIRS.filter((d) => exists(path.join(SKILLS_DIR, d))).length,
    liveRollouts: 0,
  };
}

module.exports = {
  PATHS, SKILL_DIRS, MEMORY_FILES, exists,
  setInstructionsFile, removeInstructionsFile, deployRelayProvider, removeRelayProvider,
  deployCodex, uninstallCodex, verifyCodex, detect,
  scanInjectedContext, cleanInjectedContext, inspectCodexWriteState,
  restoreOriginal, backupList: () => backup.listBackups(STATE_ROOT),
};
