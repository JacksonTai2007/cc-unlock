import {state,$,el,button,date,textValue,canWrite,writeHint,loading,api} from './editor-api.js';
let actions={};
export function bindActions(value){actions=value;}
export function renderThreads(){
 const list=$('thread-list');list.setAttribute('aria-busy','false');list.replaceChildren();
 if(!state.threads.length){list.append(el('p','list-empty',$('search').value?'没有匹配的对话。尝试更短的关键词。':'这里还没有对话记录。'));return;}
 for(const thread of state.threads){
  const row=button('','thread-item'+(thread.id===state.activeId?' active':''),()=>selectThread(thread.id));
  row.setAttribute('aria-pressed',String(thread.id===state.activeId));row.title=thread.id;
  const meta=el('span','thread-meta');meta.append(el('span','',date(thread.updated_at)),el('span','',thread.archived?'已归档':''));
  row.append(el('span','thread-title',thread.title||'未命名对话'),meta);list.append(row);
 }
}
export function clearDetail(){
 ++state.detailRequest;state.activeId=null;state.detail=null;$('empty-state').hidden=false;$('detail-header').hidden=true;$('detail-scroll').hidden=true;renderThreads();
}
export async function loadThreads(){
 const request=++state.listRequest,q=$('search').value.trim();$('search-clear').hidden=!q;loading($('thread-list'),'正在读取对话…');
 try{const data=await api('/api/threads?q='+encodeURIComponent(q));if(request!==state.listRequest)return;state.threads=data.threads||[];$('thread-count').textContent=state.threads.length;renderThreads();}
 catch(error){if(request!==state.listRequest)return;$('thread-list').setAttribute('aria-busy','false');const wrap=el('div','list-empty',error.message);wrap.append(button('重试','btn',()=>loadThreads()));$('thread-list').replaceChildren(wrap);}
}
export async function selectThread(id){
 const request=++state.detailRequest;state.activeId=id;state.detail=null;renderThreads();$('empty-state').hidden=true;$('detail-header').hidden=true;$('detail-scroll').hidden=false;loading($('detail-scroll'),'正在读取消息…');
 try{const detail=await api('/api/thread?id='+encodeURIComponent(id));if(request!==state.detailRequest)return;state.detail=detail;renderDetail();}
 catch(error){if(request!==state.detailRequest)return;$('detail-scroll').setAttribute('aria-busy','false');const wrap=el('div','list-empty',error.message);wrap.append(button('重新读取','btn',()=>selectThread(id)));$('detail-scroll').replaceChildren(wrap);}
}
export function renderDetail(){
 if(!state.detail)return;const data=state.detail,thread=data.thread,turns=data.turns||[];
 $('detail-header').hidden=false;$('detail-scroll').hidden=false;$('detail-scroll').setAttribute('aria-busy','false');
 const heading=el('div','detail-heading');heading.append(el('h2','',thread.title||'未命名对话'),el('p','detail-meta',turns.length+' 轮 · '+turns.reduce((n,t)=>n+(t.messages||[]).length,0)+' 条消息 · '+date(thread.updated_at)));
 const controls=el('div','detail-actions');
 for(const [text,action,cls]of [['重命名',()=>actions.rename(),'btn small'],['删除对话',()=>actions.remove('delete_thread'),'btn danger small']]){const b=button(text,cls,action);b.disabled=!canWrite();b.title=canWrite()?'':writeHint();controls.append(b);}
 const top=el('div','detail-top');top.append(heading,controls);
 const source=el('details','source');source.append(el('summary','','来源详情'),el('div','source-path','对话 ID：'+thread.id+'\n记录文件：'+(data.rollout_path||'无对应 JSONL')+'\n数据目录：'+(state.status?.home||'未知')));
 $('detail-header').replaceChildren(top,source);$('detail-scroll').replaceChildren();
 if(data.warnings?.length){const warning=el('details','warning-box');warning.append(el('summary','','同步范围说明 · '+data.warnings.length+' 项'));for(const text of data.warnings)warning.append(el('p','',text));$('detail-scroll').append(warning);}
 if(!turns.length){$('detail-scroll').append(el('p','list-empty','此对话没有可显示的消息。'));return;}
 turns.forEach((turn,index)=>{
  const section=el('section','turn'),bar=el('div','turn-bar');
  const cut=button('从本轮起删除','btn small danger',()=>actions.remove('truncate',{turn_id:turn.id}));
  cut.disabled=!canWrite()||!turn.can_truncate;cut.title=!canWrite()?writeHint():turn.reason||'删除本轮与之后全部轮次';
  bar.append(el('span','','第 '+(index+1)+' 轮 · '+date(turn.timestamp)),cut);section.append(bar);
  for(const message of turn.messages||[]){
   const role=String(message.role||'unknown'),card=el('article','message '+(['user','assistant'].includes(role)?role:'other')),label=el('div','message-label');
   label.append(el('span','',({user:'你 · USER',assistant:'Codex · ASSISTANT',tool:'工具 · TOOL',system:'系统 · SYSTEM',developer:'配置 · DEVELOPER'})[role]||role));
   if(['user','assistant'].includes(role)){
    const edit=button('编辑','btn small',()=>actions.edit(turn,message));edit.setAttribute('aria-label','编辑第 '+(index+1)+' 轮'+(role==='user'?'用户':'助手')+'消息');
    label.append(edit);
   }
   card.append(label);const text=textValue(message.text);
   if(text.length>4500||role==='tool'){const details=el('details');details.append(el('summary','','展开正文 · '+text.length.toLocaleString('zh-CN')+' 字符'),el('pre','message-body',text||'（空消息）'));card.append(details);}
   else card.append(el('div','message-body',text||'（空消息）'));
   section.append(card);
  }
  $('detail-scroll').append(section);
 });
}