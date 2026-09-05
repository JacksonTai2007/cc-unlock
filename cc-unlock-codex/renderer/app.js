/* cc-unlock for Codex — renderer logic. Talks to main via window.ccAPI.
   Falls back to MOCK when opened in a plain browser (design preview). */
'use strict';

const HAS_BRIDGE = typeof window !== 'undefined' && window.ccAPI;
const DONATE_URL = 'https://jacksontai2007.github.io/donate/';

const MOCK = {
  env: {
    codexInstalled: true, codexVersion: '0.141.0', configPresent: true, deployed: true, relayConfigured: false,
    cfgInstr: true, spBundle: true, agentsBundle: true, memFiles: 3, rolloutFiles: 104, skillDirs: 2,
    liveSp: true, liveAgents: true, liveMem: 3, liveSkills: 2, liveRollouts: 104,
  },
  paths: { codexDir: 'C:\\Users\\you\\.codex', bundle: 'C:\\Users\\you\\cc-unlock\\codex-files', skills: 'C:\\Users\\you\\cc-unlock\\cc-unlock-files\\skill-bundle' },
};

const api = HAS_BRIDGE ? window.ccAPI : {
  detect: async () => MOCK.env,
  paths: async () => MOCK.paths,
  deploy: async (opts, onLog) => mockRun('deploy', opts, onLog),
  uninstall: async (onLog) => mockRun('uninstall', {}, onLog),
  verify: async (onLog) => mockRun('verify', {}, onLog),
  restore: async (onLog) => mockRun('restore', {}, onLog),
};

function mockRun(kind, opts, onLog) {
  return new Promise((resolve) => {
    const steps = [];
    if (kind === 'deploy') {
      steps.push(['head', 'Codex 配置']);
      steps.push(['ok', 'system-prompt.md (17321 bytes) — 人格 base (JIT harness + Layer1/2/3)']);
      steps.push(['ok', 'AGENTS.md — 冗余人格层']);
      steps.push(['ok', 'config.toml — model_instructions_file (merged)']);
      if (opts.relayUrl) steps.push(['ok', `relay provider: ${opts.relayUrl}`]);
      steps.push(['ok', 'memories/ (3) — persona + delivery many-shot']);
      steps.push(['ok', 'rollout_summaries/ (104 files)']);
      steps.push(['ok', 'skills/sec-forge + jit-harness (2)']);
      steps.push(['done', '完成。请重启 Codex。']);
    } else if (kind === 'uninstall') {
      steps.push(['head', 'Codex 卸载']);
      steps.push(['ok', 'removed AGENTS.md + system-prompt.md']);
      steps.push(['ok', 'removed config.toml key + memories + rollouts + skills']);
      steps.push(['done', '完成。请重启 Codex。']);
    } else if (kind === 'restore') {
      steps.push(['head', '恢复原始 Codex 配置']);
      steps.push(['ok', '恢复原始 config.toml（首次部署前的字节）']);
      steps.push(['ok', '删除(部署前不存在) AGENTS.md']);
      steps.push(['ok', '清除 cc-unlock 新增的 memories / skills / rollouts']);
      steps.push(['done', '已恢复到部署前状态。请重启 Codex。']);
    } else {
      steps.push(['head', 'Codex 验证']);
      steps.push(['ok', 'system-prompt.md · model_instructions_file · AGENTS.md · memories 3/3 · skills 2/2 · rollouts 104']);
      steps.push(['done', '验证完成。']);
    }
    let i = 0;
    const t = setInterval(() => { if (i >= steps.length) { clearInterval(t); resolve({ ok: true }); return; } onLog(steps[i][0], steps[i][1]); i++; }, 150);
  });
}

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };

// Nav
$$('.nav__item').forEach((b) => b.addEventListener('click', () => {
  $$('.nav__item').forEach((x) => x.classList.remove('is-active'));
  b.classList.add('is-active');
  $$('.page').forEach((p) => p.classList.remove('is-active'));
  $(`#page-${b.dataset.page}`).classList.add('is-active');
}));

// Console
const consoleEl = $('#console');
function logLine(kind, text) {
  const cls = { ok: 'log-ok', fail: 'log-fail', warn: 'log-warn', info: 'log-info', head: 'log-head', done: 'log-done' }[kind] || 'log-info';
  const prefix = { ok: '[ok] ', fail: '[FAIL] ', warn: '[!] ', head: '--- ', done: '' }[kind] || '';
  const suffix = kind === 'head' ? ' ---' : '';
  consoleEl.appendChild(el('span', `console__line ${cls}`, prefix + text + suffix));
  consoleEl.scrollTop = consoleEl.scrollHeight;
}
const logClear = () => { consoleEl.innerHTML = ''; };

function setTile(id, val, cls, meta) {
  const v = $(id); if (!v) return;
  v.textContent = val; v.className = 'tile__value' + (cls ? ' ' + cls : '');
  if (val.length > 6) v.style.fontSize = '16px';
  if (meta) { const m = v.parentElement.querySelector('.tile__meta'); if (m) m.textContent = meta; }
}

async function loadOverview() {
  const e = await api.detect();
  const ver = !e.codexInstalled ? '未检测' : (e.codexVersion && e.codexVersion !== '?' ? ('v' + e.codexVersion) : '已安装');
  setTile('#tCodex', ver, e.codexInstalled ? 'ok' : 'err', e.codexInstalled ? '~/.codex' : '未安装');
  setTile('#tSp', e.liveSp ? '就位' : '缺失', e.liveSp ? 'ok' : 'warn', '人格 base');
  setTile('#tConfig', e.cfgInstr ? '已注入' : '未注入', e.cfgInstr ? 'ok' : 'warn', 'model_instructions_file');
  setTile('#tRelay', e.relayConfigured ? '已配置' : '未用', e.relayConfigured ? 'ok' : '', 'relay provider');
  setTile('#tCfgBundle', (e.spBundle && e.agentsBundle) ? 'OK' : '缺失', (e.spBundle && e.agentsBundle) ? 'ok' : 'warn');
  setTile('#tMem', String(e.memFiles), e.memFiles ? 'ok' : 'warn', 'persona + many-shot');
  setTile('#tRollout', String(e.rolloutFiles), e.rolloutFiles ? 'ok' : 'warn', '交付历史');
  setTile('#tSkills', String(e.skillDirs), e.skillDirs ? 'ok' : 'warn', 'sec-forge + jit-harness');
  $('#hdrMeta').textContent = (e.codexInstalled && e.codexVersion && e.codexVersion !== '?') ? `v2.0-stable · Codex ${e.codexVersion}` : 'v2.0-stable';
}
async function loadPaths() {
  const p = await api.paths();
  $('#pCodex').value = p.codexDir; $('#pBundle').value = p.bundle; $('#pSkills').value = p.skills;
}

// Relay toggle
const tglRelay = $('#tglRelay');
function syncRelay() {
  const on = tglRelay.checked;
  ['#relayUrl', '#relayKey', '#relayModel'].forEach((s) => { $(s).disabled = !on; });
}
tglRelay.addEventListener('change', syncRelay);

function relayOpts() {
  if (!tglRelay.checked || !$('#relayUrl').value.trim()) return {};
  return { relayUrl: $('#relayUrl').value.trim(), relayKey: $('#relayKey').value.trim(), relayModel: $('#relayModel').value.trim() };
}

$('#btnDeploy').addEventListener('click', async () => { logClear(); await api.deploy(relayOpts(), logLine); await loadOverview(); });
$('#btnUninstall').addEventListener('click', async () => { logClear(); await api.uninstall(logLine); await loadOverview(); });
$('#btnVerify').addEventListener('click', async () => { logClear(); await api.verify(logLine); });
$('#btnRestore').addEventListener('click', async () => { logClear(); await api.restore(logLine); await loadOverview(); });

// External links
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[data-external]'); if (!a) return;
  ev.preventDefault();
  let href = a.getAttribute('href');
  if (href === '#donate') href = DONATE_URL;
  if (api.openExternal) api.openExternal(href); else window.open(href, '_blank', 'noopener');
});

(async function boot() {
  if (!HAS_BRIDGE) $('.header__meta').textContent = 'v2.0-stable · preview';
  syncRelay();
  await Promise.all([loadOverview(), loadPaths()]);
})();
