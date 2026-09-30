'use strict';
window.ContextPanel = (() => {
  const { api, $, log, tile } = window.CCUI;
  const button = $('#btnContextClean'), status = $('#contextStatus'), output = $('#contextConsole');
  let busy = false;

  async function clean() {
    if (busy) return;
    busy = true;
    button.disabled = true;
    button.textContent = '正在清理…';
    output.replaceChildren();
    status.className = 'notice';
    status.textContent = '先删除当前用户目录的全部锁文件，再清理目标字段；保留对话正文…';
    status.setAttribute('aria-busy', 'true');
    try {
      const result = await api.contextClean((kind, text) => log(output, kind, text));
      if (!result) throw new Error('后台没有返回执行结果，请查看日志。');
      const locks = result.threadWriterLocks?.removed?.length || 0;
      const failures = result.failures || [];
      const conflicts = result.skippedChangedDuringScan?.length || 0;
      const changed = result.recordsNeutralized || 0;
      const uncertain = result.uncertainWriteCount || result.uncertainWrites?.length || 0;
      const partialRecords = result.recordsPartiallyNeutralized || 0;
      tile('#ctxLocks', String(locks), locks ? 'ok' : '');
      tile('#ctxHits', String(changed));
      tile('#ctxChanged', String(result.filesChanged || 0));
      if (result.busy) {
        status.className = 'notice error';
        status.textContent = result.error || '另一项维护正在执行，请稍后重试。';
      } else if (result.status === 'partial') {
        status.className = 'notice error';
        status.textContent = `已确认清理 ${changed} 条，${conflicts} 个并发冲突、${failures.length} 项失败。未完成项请查看日志。`;
      } else if (result.ok === false) {
        status.className = 'notice error';
        status.textContent = '未完成：' + (result.error || result.blockedReason || '目标文件不可写，请查看日志。');
      } else {
        status.textContent = changed ? `已清理 ${changed} 条上下文记录；保留对话正文和其他字段。` : '没有匹配的上下文字段。';
      }
      if (result.threadWriterLocks?.skipped && result.threadWriterLocks.skipped !== 'not-requested') {
        status.textContent += ' 本次锁清理未执行，请查看日志中的具体原因。';
      } else if (locks) status.textContent += ` 已删除 ${locks} 个锁文件。`;
      if (partialRecords) status.textContent += ` 另有 ${partialRecords} 条记录仅部分字段完成。`;
      if (uncertain) status.textContent += ` ${uncertain} 次写入未能确认最终状态，磁盘可能已修改；请重新加载后检查。`;
      if (result.requiresReload || uncertain) {
        status.textContent += result.liveContextWarning ? ` ${result.liveContextWarning}` : ' 操作涉及磁盘历史；当前模型内存不因此改变。';
      } else if (result.diskOnly && result.currentContextUpdated === false) {
        status.textContent += ' 本操作只处理磁盘历史，不刷新当前模型内存。';
      }
      for (const entry of result.uncertainWrites || []) log(output, 'warn', `${entry.file || ''}：写入状态不确定（${entry.phase || '复核'}），${entry.reason || '请检查记录'}`);
      for (const failure of failures) log(output, 'fail', failure.error || failure.message || String(failure));
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
