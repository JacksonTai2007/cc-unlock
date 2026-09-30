'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mappings = [
  ['prompts/claude.md', 'cc-unlock-files/claude-config-bundle/CLAUDE.md'],
  ['prompts/codex-system.md', 'codex-files/codex-config-bundle/system-prompt.md'],
  ['prompts/codex-agents.md', 'codex-files/codex-config-bundle/AGENTS.md'],
];
function inside(relative) {
  const absolute = path.resolve(root, relative);
  const back = path.relative(root, absolute);
  if (back.startsWith('..') || path.isAbsolute(back)) throw new Error(`Path escaped project: ${relative}`);
  return absolute;
}
function sync(mode, { quiet = false } = {}) {
  if (!['--check', '--write'].includes(mode)) throw new Error('Usage: node scripts/sync-prompts.cjs [--check|--write]');
  const results = [], mismatches = [];
  for (const [sourceName, targetName] of mappings) {
    const source = inside(sourceName), target = inside(targetName);
    const bytes = fs.readFileSync(source);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!decoded.trim() || decoded.includes('\0')) throw new Error(`Invalid UTF-8 prompt: ${sourceName}`);
    if (mode === '--write') {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
    }
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) mismatches.push(targetName);
    results.push({ source, target, bytes: bytes.length });
  }
  if (mismatches.length) throw new Error(`Prompt copies differ: ${mismatches.join(', ')}. Run --write to sync prompt carriers.`);
  const report = { status: 'PASS', mappings: results };
  if (!quiet) console.log(JSON.stringify(report, null, 2));
  return report;
}
if (require.main === module) {
  try { sync(process.argv[2] || '--check'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { sync, mappings };
