import {state,el,button,textValue,canWrite,writeHint,api,toast} from './editor-api.js';
import {modal,closeModal,modalError,setBusy,requireConfirmation} from './editor-dialog.js';
import {selectThread,clearDetail,loadThreads} from './editor-view.js';
let refreshStatus=async()=>{};
export function bindStatus(refresh){refreshStatus=refresh;}
function draftKey(thread,turn,message){return JSON.stringify([thread,turn.id,message.item_id||message.message_key||message.force_ref||[message.role,message.text]]);}
function resolveMessage(detail,oldTurn,oldMessage){
 const rows=(detail.turns||[]).flatMap(turn=>(turn.messages||[]).map(message=>({turn,message}))),roleRows=rows.filter(row=>row.message.role===oldMessage.role);
 const unique=matches=>matches.length===1?matches[0]:null;
 let match=oldMessage.item_id?unique(roleRows.filter(row=>row.turn.id===oldTurn.id&&row.message.item_id===oldMessage.item_id)):null;
 if(!match&&oldMessage.message_key)match=unique(roleRows.filter(row=>row.message.message_key===oldMessage.message_key));
 if(!match){const same=roleRows.filter(row=>textValue(row.message.text)===textValue(oldMessage.text));match=unique(same.filter(row=>row.turn.id===oldTurn.id))||unique(same);}
 if(!match)throw new Error('无法唯一定位原消息，未保存。草稿保留，请刷新后对照记录。');
 if(textValue(match.message.text)!==textValue(oldMessage.text))throw new Error('消息已被其他窗口修改，未保存。草稿保留；请复制并与最新正文对照。');return match;
}
function needsWarning(plan,force=false){return force||/共享|shared|projection|投影|compaction|压缩快照|未同步|不同步|副本.{0,8}未/.test(plan.summary||'');}
async function committed(m,plan,threadId,key,remove=false){
 const result=await api('/api/apply',{plan_id:plan.plan_id,confirm:threadId});
 if(!result.ok)throw new Error('后台没有确认保存成功，请刷新核对结果。');
 if(key)state.drafts.delete(key);m.busy=false;closeModal(true);toast(remove?'删除已完成。':'已保存。未创建新备份，writer 锁保持不变。');
 if(result.cleanup_warning)toast(result.cleanup_warning,true);
 if(remove)clearDetail();await loadThreads();if(!remove&&state.activeId===threadId)await selectThread(threadId);
}
export function edit(turn,message){
 if(!state.detail)return;const threadId=state.detail.thread.id,key=draftKey(threadId,turn,message),force=message.editable!==true;
 const original=textValue(force?(message.force_text??message.text):message.text),m=modal('编辑消息');
 const label=el('label','','消息正文');label.htmlFor='message-edit-input';
 const input=el('textarea','text-input message-editor');input.id='message-edit-input';input.spellcheck=false;input.value=state.drafts.get(key)??original;
 input.setAttribute('aria-describedby','message-edit-help message-edit-count');
 const help=el('p','input-helper','只修改历史文字，保留后续轮次，不重新生成回答。Ctrl / ⌘ Enter 保存。');help.id='message-edit-help';
 const count=el('p','input-helper');count.id='message-edit-count';m.body.append(label,input,count,help);
 if(force)m.body.append(el('p','warning-box','这条记录不满足普通编辑条件。保存时会重新定位原文，并要求明确确认实际写入范围。'));
 let plan=null,confirmedText='',check=null,confirmHandler=null;
 const save=button('保存','btn primary',async()=>{
  if(m.busy||save.disabled)return;setBusy(m,true);input.disabled=true;save.textContent='正在保存…';
  try{
   await refreshStatus();if(!canWrite())throw new Error(writeHint());
   if(plan&&confirmedText===input.value&&check?.checked){await committed(m,plan,threadId,key);return;}
   let snapshot=state.detail,selected={turn,message};
   if(force){snapshot=await api('/api/thread?id='+encodeURIComponent(threadId));selected=resolveMessage(snapshot,turn,message);if(!selected.message.force_editable||!selected.message.force_ref)throw new Error(selected.message.force_reason||'无法定位可写原文，未保存。');}
   const extra={turn_id:selected.turn.id,message_key:selected.message.message_key,text:input.value,...(force?{force_ref:selected.message.force_ref}:{})};
   plan=await api('/api/preview',{action:force?'force_edit_message':'edit_message',thread_id:threadId,revision:snapshot.revision,...extra});
   if(needsWarning(plan,force)){
    confirmedText=input.value;check=requireConfirmation(m,plan,force);confirmHandler=()=>{save.disabled=!check.checked;};check.addEventListener('change',confirmHandler);
    setBusy(m,false);input.disabled=false;save.textContent='确认保存';save.disabled=true;check.focus();return;
   }
   await committed(m,plan,threadId,key);
  }catch(error){modalError(m,error);setBusy(m,false);input.disabled=false;save.textContent=check?'确认保存':'保存';update();}
 });
 m.save=save;m.dirty=()=>input.value!==original;
 const update=()=>{
  const length=force?new TextEncoder().encode(input.value).length:input.value.length,limit=force?2097152:120000;
  count.textContent=length.toLocaleString('zh-CN')+(force?' / 2 MiB 字节':' / 120,000 字符')+(input.value===original?' · 未修改':' · 草稿未保存');
  save.disabled=m.busy||input.value===original||length>limit||(check&&!check.checked);
 };
 input.addEventListener('input',()=>{state.drafts.set(key,input.value);plan=null;check=null;m.body.querySelector('.confirmation')?.remove();save.textContent='保存';update();});
 m.foot.append(button('取消','btn',()=>closeModal()),save);update();input.focus();input.setSelectionRange(0,0);
}
export function rename(){
 if(!state.detail)return;const threadId=state.detail.thread.id,original=state.detail.thread.title||'',key='title:'+threadId,m=modal('重命名对话',true);
 const label=el('label','','新标题');label.htmlFor='rename-input';const input=el('input','text-input');input.id='rename-input';input.maxLength=180;input.value=state.drafts.get(key)??original;m.body.append(label,input,el('p','input-helper','最多 180 字符，只改标题，不改正文。'));
 const save=button('保存','btn primary',async()=>{
  if(save.disabled||m.busy)return;setBusy(m,true);input.disabled=true;
  try{await refreshStatus();if(!canWrite())throw new Error(writeHint());const plan=await api('/api/preview',{action:'rename',thread_id:threadId,revision:state.detail.revision,title:input.value.trim()});await committed(m,plan,threadId,key);}
  catch(error){modalError(m,error);setBusy(m,false);input.disabled=false;update();}
 });
 const update=()=>{save.disabled=!input.value.trim()||input.value.trim()===original||m.busy;};
 m.save=save;m.dirty=()=>input.value!==original;input.addEventListener('input',()=>{state.drafts.set(key,input.value);update();});
 input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();save.click();}});
 m.foot.append(button('取消','btn',()=>closeModal()),save);update();input.focus();input.select();
}
export async function remove(action,extra={}){
 if(!state.detail||!canWrite()){toast(writeHint(),true);return;}const threadId=state.detail.thread.id,m=modal(action==='truncate'?'删除本轮与后续内容？':'删除整个对话？',true);
 m.body.append(el('p','input-helper','正在核对影响范围…'));m.busy=true;m.close.disabled=true;
 try{
  const plan=await api('/api/preview',{action,thread_id:threadId,revision:state.detail.revision,...extra});
  m.body.replaceChildren();const check=requireConfirmation(m,plan);m.busy=false;m.close.disabled=false;
  const save=button('确认删除','btn danger',async()=>{if(!check.checked||m.busy)return;setBusy(m,true);check.disabled=true;try{await committed(m,plan,threadId,null,action==='delete_thread');}catch(error){modalError(m,error);setBusy(m,false);check.disabled=false;save.disabled=!check.checked;}});
  save.disabled=true;check.addEventListener('change',()=>save.disabled=!check.checked);m.save=save;m.foot.append(button('取消','btn',()=>closeModal()),save);check.focus();
 }catch(error){m.busy=false;m.close.disabled=false;modalError(m,error);m.foot.append(button('关闭','btn',()=>closeModal()));}
}