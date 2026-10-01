'use strict';
window.ContextPanel = (() => {
  const { api, $, log, tile } = window.CCUI;
  const button = $('#btnContextClean'), status = $('#contextStatus'), output = $('#contextConsole');
  let busy = false;
  const count = value => Number.isFinite(value) && value >= 0 ? value : 0;
  const failureKey = entry => JSON.stringify([entry?.file || '', entry?.error || entry?.message || '']);

  function showResult(result) {
    const locks = count(result.threadWriterLocks?.removed?.length);
    const pending = count(result.threadWriterLocks?.pendingDeletion?.length);
    const lockFailures = result.threadWriterLocks?.failures || [];
    const lockKeys = new Set(lockFailures.map(failureKey));
    // Older workers combine both stages. Never infer scan completion from a zero hit count.
    const contextFailures = Array.isArray(result.contextFailures) ? result.contextFailures :
      (result.failures || []).filter(entry => !lockKeys.has(failureKey(entry)));
    const conflicts = count(result.skippedChangedDuringScan?.length);
    const changed = count(result.recordsNeutralized);
    const uncertain = count(result.uncertainWriteCount || result.uncertainWrites?.length);
    const partialRecords = count(result.recordsPartiallyNeutralized);
    const scanned = count(result.filesScanned);
    const totalKnown = Number.isFinite(result.filesEnumerated) && result.filesEnumerated >= 0;
    const scanCount = totalKnown ? `${scanned} / ${result.filesEnumerated}` : String(scanned);
    tile('#ctxLocks', String(locks), locks ? 'ok' : '');
    tile('#ctxHits', String(changed));
    tile('#ctxChanged', String(count(result.filesChanged)));
    tile('#ctxScanned', result.scanStarted === false ? '未开始' :
      result.scanStarted === true || result.scanCompleted === true ? scanCount : '未确认');

    if (result.busy) {
      status.className = 'notice error';
      status.textContent = result.error || '另一项维护正在执行，请稍后重试。';
      return;
    }
    const messages = [];
    if (result.scanStarted === false || result.contextStatus === 'not-started') {
      messages.push('历史清理未开始。');
    } else if (result.scanCompleted === true) {
      messages.push(`历史遍历完成：已扫描 ${scanCount} 个文件。`);
      if (result.contextStatus === 'no-match') messages.push('没有匹配的上下文字段。');
      else messages.push(`已确认清理 ${changed} 条上下文记录；保留对话正文。`);
    } else if (result.scanStarted === true) {
      messages.push(`历史扫描未完成：已扫描 ${scanCount} 个文件，已确认清理 ${changed} 条。`);
    } else {
      messages.push(`历史扫描完成状态未确认；已确认清理 ${changed} 条。`);
    }
    if (contextFailures.length || conflicts) {
      messages.push(`历史处理：${contextFailures.length} 项失败、${conflicts} 个并发冲突。`);
    }
    const skipped = result.threadWriterLocks?.skipped;
    if (skipped && skipped !== 'not-requested') messages.push(`锁清理未执行（${skipped}）。`);
    else messages.push(`锁清理：已删除 ${locks} 个锁文件，${pending} 个已标记删除、等待句柄释放，${lockFailures.length} 项删除失败。`);
    if (pending) messages.push('等待中的锁不计入删除成功或失败；不表示文件已全部消失。');
    if (lockFailures.length) messages.push('删锁失败与历史清理结果独立，具体原因见日志。');
    if (partialRecords) messages.push(`另有 ${partialRecords} 条记录仅部分字段完成。`);
    if (uncertain) messages.push(`${uncertain} 次写入未能确认最终状态，磁盘可能已修改；请重新加载后检查。`);
    if (result.error || result.blockedReason) messages.push(result.error || result.blockedReason);
    if (result.requiresReload || uncertain) {
      messages.push(result.liveContextWarning || '操作涉及磁盘历史；当前模型内存不因此改变。');
    } else if (result.diskOnly && result.currentContextUpdated === false) {
      messages.push('本操作只处理磁盘历史，不刷新当前模型内存。');
    }
    if (result.logFile) messages.push(`日志：${result.logFile}`);
    const incomplete = result.ok === false || lockFailures.length || contextFailures.length || conflicts || uncertain ||
      result.contextStatus === 'partial' || result.contextStatus === 'not-started' ||
      (result.scanStarted === true && result.scanCompleted !== true);
    status.className = incomplete ? 'notice error' : pending ? 'notice warn' : 'notice';
    status.textContent = messages.join(' ');
    for (const entry of result.uncertainWrites || []) log(output, 'warn', `${entry.file || ''}：写入状态不确定（${entry.phase || '复核'}），${entry.reason || '请检查记录'}`);
    for (const failure of lockFailures) log(output, 'fail', `删锁失败：${failure.file || ''} ${failure.error || failure.message || String(failure)}`);
    for (const failure of contextFailures) log(output, 'fail', `历史处理失败：${failure.file || ''} ${failure.error || failure.message || String(failure)}`);
  }

  async function clean() {
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.textContent = '正在清理…';
    output.replaceChildren();
    status.className = 'notice';
    status.textContent = '先删除当前用户目录的全部锁文件，再自动遍历全部历史并清理目标字段；保留对话正文…';
    status.setAttribute('aria-busy', 'true');
    try {
      const result = await api.contextClean((kind, text) => log(output, kind, text));
      if (!result) throw new Error('后台没有返回执行结果，请查看日志。');
      showResult(result);
    } catch (error) {
      status.className = 'notice error';
      status.textContent = '未完成：' + error.message;
      log(output, 'fail', error.message);
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = '一键清理';
      status.setAttribute('aria-busy', 'false');
    }
  }
  button.addEventListener('click', clean);
  return { isBusy: () => busy };
})();
