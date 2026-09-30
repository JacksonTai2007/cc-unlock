import {state,$,el,button,api,canWrite,writeHint,toast} from './editor-api.js';
import {bindActions,loadThreads,selectThread,renderDetail} from './editor-view.js';
import {modal,closeModal,modalError,setBusy,modalKeyboard} from './editor-dialog.js';
import {bindStatus,edit,rename,remove} from './editor-actions.js';
if(new URLSearchParams(location.search).get('embedded')==='1')document.documentElement.classList.add('is-embedded');
export async function refreshStatus(){
 state.status=await api('/api/status');const s=state.status,demo=s.mode==='demo';
 $('mode-badge').textContent=s.update_required?'服务需重启':demo?'演示数据':canWrite()?'本地 · 可写':'只读连接';
 $('statusbar').className='statusbar'+(!canWrite()?' error':'');
 $('status-text').textContent=!canWrite()?writeHint():demo?'隔离演示数据，可安全试用；不影响真实对话。':'连接已就绪。只改本地历史；不创建备份。请勿在多个窗口同时修改同一条消息。';
 $('sidebar-mode').textContent=demo?'隔离演示数据':'本地数据 · 不上传';$('sidebar-mode').title=s.home||'';return s;
}
async function refreshAll(reload=true){
 if(state.refreshing||state.stopped)return;state.refreshing=true;$('refresh-btn').disabled=true;
 try{await refreshStatus();await loadThreads();if(reload&&state.activeId)await selectThread(state.activeId);else if(state.detail)renderDetail();}
 catch(error){state.status=null;$('mode-badge').textContent='连接失败';$('statusbar').className='statusbar error';$('status-text').textContent=error.message+' 草稿保留；恢复连接后重试。';toast(error.message,true);}
 finally{state.refreshing=false;$('refresh-btn').disabled=state.stopped;}
}
function shutdown(){
 const m=modal('关闭本地编辑服务？',true);m.body.append(el('p','','只关闭编辑服务，不关闭 Codex，不修改对话。重新打开编辑页面时可以重新连接。'));
 const save=button('关闭服务','btn primary',async()=>{setBusy(m,true);try{const result=await api('/api/shutdown',{});if(!result.ok)throw new Error('服务未确认关闭。');m.busy=false;closeModal(true);state.stopped=true;state.status=null;$('mode-badge').textContent='服务已关闭';$('status-text').textContent='本地服务已关闭。请重新打开编辑器页面以连接。';$('refresh-btn').disabled=true;$('shutdown-btn').disabled=true;$('search').disabled=true;document.querySelectorAll('.detail-actions button,.message-label button,.turn-bar button').forEach(node=>node.disabled=true);}catch(error){modalError(m,error);setBusy(m,false);}});
 m.foot.append(button('取消','btn',()=>closeModal()),save);
}
bindActions({edit,rename,remove});bindStatus(refreshStatus);$('refresh-btn').addEventListener('click',()=>refreshAll());$('shutdown-btn').addEventListener('click',shutdown);
let searchTimer;$('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadThreads(),240);});
$('search-clear').addEventListener('click',()=>{$('search').value='';loadThreads();$('search').focus();});
document.addEventListener('keydown',event=>{modalKeyboard(event);if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!state.modal){event.preventDefault();$('search').focus();$('search').select();}});
window.addEventListener('beforeunload',event=>{if(state.drafts.size){event.preventDefault();event.returnValue='';}});
refreshAll(false);