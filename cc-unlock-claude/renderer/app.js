/* ============================================================
   cc-unlock for Claude Code — renderer logic
   Talks to the Electron main process via window.ccAPI (preload bridge).
   Falls back to MOCK data when opened directly in a browser (design preview).
   ============================================================ */
'use strict';

// ---- Bridge: real (Electron) or mock (browser preview) ----
const HAS_BRIDGE = typeof window !== 'undefined' && window.ccAPI;

const MOCK = {
  env: {
    ccVersion: '2.1.240', ccInstalled: true,
    settings: true,
    deployedCount: 2, subagentCount: 1,
    memFiles: 15, skillDirs: 2, agentFiles: 3, claudeMd: true,
    bundleOk: true,
  },
  paths: {
    bundle: 'C:\\Users\\you\\cc-unlock-claude\\bundle',
    claudeDir: 'C:\\Users\\you\\.claude',
    projects: 'C:\\Users\\you\\.claude\\projects',
  },
  workspaces: [
    { name: 'C--Users-you-Desktop-lab', path: 'C:\\Users\\you\\Desktop\\lab', deployed: true, subagent: true },
    { name: 'C--Users-you-Desktop-re-work', path: 'C:\\Users\\you\\Desktop\\re-work', deployed: true, subagent: false },
    { name: 'C--Users-you-Documents-ctf', path: 'C:\\Users\\you\\Documents\\ctf', deployed: false, subagent: false },
  ],
};

const api = HAS_BRIDGE ? window.ccAPI : {
  detect: async () => MOCK.env,
  paths: async () => MOCK.paths,
  listWorkspaces: async () => MOCK.workspaces,
  deploy: async (targets, opts, onLog) => mockRun(targets, 'deploy', opts, onLog),
  uninstall: async (targets, onLog) => mockRun(targets, 'uninstall', {}, onLog),
  verify: async (targets, onLog) => mockRun(targets, 'verify', {}, onLog),
  restore: async (targets, onLog) => mockRun(targets, 'restore', {}, onLog),
  browse: async () => null,
};

function mockRun(targets, kind, opts, onLog) {
  return new Promise((resolve) => {
    const names = (targets && targets.length) ? targets : ['(all)'];
    const steps = [];
    const verb = kind === 'deploy' ? '部署' : kind === 'uninstall' ? '卸载' : '验证';
    names.forEach((n) => {
      steps.push(['head', `${verb}: ${n}`]);
      if (kind === 'deploy') {
        steps.push(['ok', '15 memory files -> ~/.claude/projects/.../memory/']);
        steps.push(['ok', 'MEMORY.md (anti-refusal carrier, 24KB)']);
        steps.push(['ok', 'CLAUDE.md -> workspace root']);
        steps.push(['ok', 'skills: sec-forge + jit-harness (2)']);
        if (opts.subagent) steps.push(['ok', '.claude/agents/ (3) + memory:project -> 子 agent 覆盖']);
        else steps.push(['warn', 'skip .claude/agents/ (子 agent 覆盖关闭)']);
      } else if (kind === 'uninstall') {
        steps.push(['ok', 'removed memory files + MEMORY.md']);
        steps.push(['ok', 'removed CLAUDE.md + skills + agents']);
      } else if (kind === 'restore') {
        steps.push(['ok', '恢复原始 CLAUDE.md（首次部署前的字节）']);
        steps.push(['ok', '删除(部署前不存在) 记忆索引']);
        steps.push(['ok', '清除 cc-unlock 新增的 skills / agents / rules / agent-memory']);
      } else {
        steps.push(['ok', 'memory 15/15 · CLAUDE.md OK · skills 2/2 · agents 3/3']);
      }
    });
    steps.push(['done', `完成。请重启 Claude Code。`]);
    let i = 0;
    const t = setInterval(() => {
      if (i >= steps.length) { clearInterval(t); resolve({ ok: true }); return; }
      onLog(steps[i][0], steps[i][1]); i++;
    }, 140);
  });
}

// ---- DOM helpers ----
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

// ---- Navigation ----
$$('.nav__item').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.nav__item').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const page = btn.dataset.page;
    $$('.page').forEach((p) => p.classList.remove('is-active'));
    $(`#page-${page}`).classList.add('is-active');
  });
});

// ---- Console log ----
const consoleEl = $('#console');
function logLine(kind, text) {
  const cls = { ok: 'log-ok', fail: 'log-fail', warn: 'log-warn', info: 'log-info', head: 'log-head', done: 'log-done' }[kind] || 'log-info';
  const prefix = { ok: '[ok] ', fail: '[FAIL] ', warn: '[!] ', head: '--- ', done: '' }[kind] || '';
  const suffix = kind === 'head' ? ' ---' : '';
  const line = el('span', `console__line ${cls}`, prefix + text + suffix);
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}
function logClear() { consoleEl.innerHTML = ''; }

// ---- Status tag builder ----
function statusTag(deployed) {
  return deployed
    ? '<span class="tag tag--green"><span class="tag__dot"></span>已部署</span>'
    : '<span class="tag tag--gray"><span class="tag__dot"></span>未部署</span>';
}
function subagentTag(on) {
  return on
    ? '<span class="tag tag--blue"><span class="tag__dot"></span>覆盖</span>'
    : '<span class="tag tag--gray"><span class="tag__dot"></span>—</span>';
}

// ---- State ----
let WORKSPACES = [];

// ---- Render workspace table ----
function renderWorkspaces() {
  const body = $('#wsBody');
  body.innerHTML = '';
  WORKSPACES.forEach((ws, idx) => {
    const tr = el('tr');
    tr.innerHTML =
      `<td class="col-cbx"><label class="cbx"><input type="checkbox" data-idx="${idx}" /></label></td>` +
      `<td class="path-cell" title="${ws.path}">${ws.path}</td>` +
      `<td class="col-status">${statusTag(ws.deployed)}</td>` +
      `<td class="col-status">${subagentTag(ws.subagent)}</td>`;
    body.appendChild(tr);
  });
  $('#wsCount').textContent = `${WORKSPACES.length} 个`;
}
function checkedTargets() {
  return $$('#wsBody input[type=checkbox]:checked').map((c) => WORKSPACES[+c.dataset.idx]);
}

// ---- Overview / bundle tiles ----
function setTile(id, val, cls, meta) {
  const v = $(id); if (!v) return;
  v.textContent = val;
  v.className = 'tile__value' + (cls ? ' ' + cls : '');
  if (meta) { const m = v.parentElement.querySelector('.tile__meta'); if (m) m.textContent = meta; }
}

async function loadOverview() {
  const e = await api.detect();
  const verLabel = !e.ccInstalled ? '未检测' : (e.ccVersion && e.ccVersion !== '?' ? ('v' + e.ccVersion) : '已安装');
  setTile('#tCcVer', verLabel, e.ccInstalled ? 'ok' : 'err', e.ccInstalled ? '~/.claude' : '未安装');
  setTile('#tSettings', e.settings ? '就绪' : '缺失', e.settings ? 'ok' : 'warn');
  setTile('#tDeployed', String(e.deployedCount), e.deployedCount ? 'ok' : '', `${e.deployedCount} 个工作区`);
  setTile('#tSubagent', String(e.subagentCount), e.subagentCount ? 'ok' : 'warn', `${e.subagentCount} 个已覆盖`);
  setTile('#tMem', String(e.memFiles), 'ok', 'track records');
  setTile('#tSkills', String(e.skillDirs), 'ok', 'sec-forge + jit-harness');
  setTile('#tAgents', String(e.agentFiles), 'ok', 'persona + memory');
  setTile('#tClaude', e.claudeMd ? 'OK' : '缺失', e.claudeMd ? 'ok' : 'err', 'lab-scope 人格');
  $('#hdrMeta').textContent = (e.ccInstalled && e.ccVersion && e.ccVersion !== '?') ? `v2.0-stable · CC ${e.ccVersion}` : 'v2.0-stable';
}

async function loadPaths() {
  const p = await api.paths();
  $('#pBundle').value = p.bundle;
  $('#pClaude').value = p.claudeDir;
  $('#pProjects').value = p.projects;
}

async function loadWorkspaces() {
  WORKSPACES = await api.listWorkspaces();
  renderWorkspaces();
}

// ---- Actions ----
function opts() { return { subagent: $('#tglSubagent').checked }; }

async function runDeploy(targets) {
  logClear();
  await api.deploy(targets.map((t) => t.name || t), opts(), logLine);
  await loadWorkspaces(); await loadOverview();
}
async function runUninstall(targets) {
  logClear();
  await api.uninstall(targets.map((t) => t.name || t), logLine);
  await loadWorkspaces(); await loadOverview();
}
async function runVerify(targets) {
  logClear();
  await api.verify(targets.map((t) => t.name || t), logLine);
}
async function runRestore(targets) {
  logClear();
  await api.restore(targets.map((t) => t.name || t), logLine);
  await loadWorkspaces(); await loadOverview();
}

$('#btnRefresh').addEventListener('click', async () => { logClear(); await loadWorkspaces(); logLine('info', '工作区列表已刷新。'); });

$('#btnRestore').addEventListener('click', () => {
  const t = checkedTargets();
  if (!t.length) return logAfterClear('warn', '勾选要恢复的工作区。');
  runRestore(t);
});

$('#btnDeploySel').addEventListener('click', async () => {
  const custom = $('#customPath').value.trim();
  if (custom) return runDeploy([{ name: custom, path: custom }]);
  const t = checkedTargets();
  if (!t.length) return logAfterClear('warn', '未选择工作区。勾选列表项或填自定义路径。');
  runDeploy(t);
});
$('#btnDeployAll').addEventListener('click', () => {
  if (!WORKSPACES.length) return logAfterClear('warn', '没有工作区。');
  runDeploy(WORKSPACES);
});
$('#btnUninstSel').addEventListener('click', () => {
  const t = checkedTargets();
  if (!t.length) return logAfterClear('warn', '未选择工作区。');
  runUninstall(t);
});
$('#btnUninstAll').addEventListener('click', () => {
  if (!WORKSPACES.length) return logAfterClear('warn', '没有工作区。');
  runUninstall(WORKSPACES.filter((w) => w.deployed));
});
$('#btnVerify').addEventListener('click', () => {
  const t = checkedTargets();
  runVerify(t.length ? t : WORKSPACES.filter((w) => w.deployed));
});
$('#btnBrowse').addEventListener('click', async () => {
  const picked = await api.browse();
  if (picked) $('#customPath').value = picked;
});

function logAfterClear(kind, msg) { logClear(); logLine(kind, msg); }

// ---- External links (GitHub / donation) — open in system browser under Electron ----
const DONATE_URL = 'https://jacksontai2007.github.io/donate/';
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[data-external]');
  if (!a) return;
  ev.preventDefault();
  let href = a.getAttribute('href');
  if (href === '#donate') {
    if (!DONATE_URL) { alert('捐赠链接待配置：在 app.js 顶部 DONATE_URL 填入你的捐赠页地址，或放二维码图到 assets/donate.png'); return; }
    href = DONATE_URL;
  }
  if (api.openExternal) api.openExternal(href);
  else window.open(href, '_blank', 'noopener');
});

// ---- Boot ----
(async function boot() {
  if (!HAS_BRIDGE) {
    document.querySelector('.header__meta').textContent = 'v2.0-stable · preview';
  }
  await Promise.all([loadOverview(), loadPaths(), loadWorkspaces()]);
})();
