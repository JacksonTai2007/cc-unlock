// cc-unlock — transactional backup/restore. Pure Node, no Electron deps.
//
// Model: before cc-unlock mutates a shared file (config.toml, AGENTS.md ...), call saveOnce.
// The FIRST saveOnce for a path preserves the TRUE original (byte-exact copy, or a "was-absent"
// marker if it didn't exist). restoreAll then either restores the original bytes or deletes files
// that cc-unlock created — a clean one-click "put my Codex back the way it was".
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const exists = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const ensureDir = (p) => { try { fs.mkdirSync(p, { recursive: true }); } catch {} };
function sha256(file) { try { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); } catch { return null; } }
function keyFor(filePath) { return crypto.createHash('sha1').update(path.resolve(filePath)).digest('hex').slice(0, 16); }

function manifestPath(stateRoot) { return path.join(stateRoot, 'manifest.json'); }
function loadManifest(stateRoot) { try { return JSON.parse(fs.readFileSync(manifestPath(stateRoot), 'utf8')); } catch { return {}; } }
function saveManifest(stateRoot, m) { ensureDir(stateRoot); fs.writeFileSync(manifestPath(stateRoot), JSON.stringify(m, null, 2) + '\n', 'utf8'); }

// Back up the ORIGINAL state of filePath — only the first call wins (preserves true pre-cc-unlock state).
function saveOnce(stateRoot, filePath) {
  const m = loadManifest(stateRoot);
  const k = keyFor(filePath);
  if (m[k]) return false;                       // already have the true original
  ensureDir(stateRoot);
  if (exists(filePath)) {
    const backupName = k + '__' + path.basename(filePath);
    fs.copyFileSync(filePath, path.join(stateRoot, backupName));   // byte-exact
    m[k] = { path: path.resolve(filePath), existed: true, backup: backupName, sha256: sha256(filePath), savedAt: new Date().toISOString() };
  } else {
    m[k] = { path: path.resolve(filePath), existed: false, savedAt: new Date().toISOString() };
  }
  saveManifest(stateRoot, m);
  return true;
}

// Restore one path to its original (bytes, or delete if it was absent before).
function restore(stateRoot, filePath) {
  const m = loadManifest(stateRoot);
  const e = m[keyFor(filePath)];
  if (!e) return 'no-backup';
  if (e.existed) { fs.copyFileSync(path.join(stateRoot, e.backup), e.path); return 'restored'; }
  try { fs.rmSync(e.path, { force: true }); } catch {}
  return 'removed';
}

// Restore everything cc-unlock touched, in one shot.
function restoreAll(stateRoot, log) {
  const m = loadManifest(stateRoot);
  const results = [];
  for (const k of Object.keys(m)) {
    const e = m[k];
    try {
      if (e.existed) {
        fs.copyFileSync(path.join(stateRoot, e.backup), e.path);
        results.push({ path: e.path, action: 'restored' });
        if (log) log('ok', `恢复原始 ${e.path}`);
      } else {
        fs.rmSync(e.path, { force: true });
        results.push({ path: e.path, action: 'removed' });
        if (log) log('ok', `删除(部署前不存在) ${e.path}`);
      }
    } catch (err) {
      results.push({ path: e.path, action: 'fail', error: String(err && err.message || err) });
      if (log) log('fail', `${e.path}: ${err.message}`);
    }
  }
  return results;
}

function listBackups(stateRoot) {
  const m = loadManifest(stateRoot);
  return Object.values(m).map((e) => ({ path: e.path, existed: e.existed, savedAt: e.savedAt }));
}
function hasState(stateRoot) { return exists(manifestPath(stateRoot)); }
function clearState(stateRoot) { try { fs.rmSync(stateRoot, { recursive: true, force: true }); return true; } catch { return false; } }

module.exports = { saveOnce, restore, restoreAll, listBackups, hasState, clearState, sha256 };
