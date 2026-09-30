import {state,$,el,button} from './editor-api.js';
export function closeModal(force=false){
 const modal=state.modal;if(!modal||modal.busy)return false;
 if(!force&&modal.dirty&&modal.dirty()&&!window.confirm('草稿未保存。关闭编辑？草稿保留在当前页面。'))return false;
 state.modal=null;$('modal-root').replaceChildren();modal.previousFocus?.focus?.();return true;
}
export function modal(title,compact=false){
 const previousFocus=state.modal?.previousFocus||document.activeElement,layer=el('div','modal-layer'),box=el('section','modal'+(compact?' compact':''));
 box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','modal-title');
 const head=el('div','modal-header'),heading=el('h2','',title);heading.id='modal-title';
 const close=button('关闭','btn small',()=>closeModal());close.setAttribute('aria-label','关闭编辑弹窗');
 const body=el('div','modal-content'),foot=el('div','modal-footer');head.append(heading,close);box.append(head,body,foot);layer.append(box);
 $('modal-root').replaceChildren(layer);const value={layer,box,body,foot,close,previousFocus,busy:false};state.modal=value;close.focus();return value;
}
export function modalError(m,error){
 let target=m.body.querySelector('.modal-error');if(!target){target=el('p','modal-error');target.setAttribute('role','alert');target.tabIndex=-1;m.body.append(target);}
 target.textContent=error.message||String(error);target.focus();
}
export function setBusy(m,busy){m.busy=busy;m.close.disabled=busy;for(const control of m.foot.querySelectorAll('button'))control.disabled=busy;}
export function requireConfirmation(m,plan,force=false){
 m.body.querySelector('.confirmation')?.remove();const box=el('div','confirmation');
 box.append(el('p','warning-box',force?'普通校验未通过，将按精确记录位置写入已识别副本。不会同步运行中窗口，也不创建新备份。':'此操作不可从新备份撤销，请核对影响范围。'),el('p','',plan.summary||'请核对变更。'));
 if(plan.warning)box.append(el('p','input-helper',plan.warning));
 const details=el('details');details.append(el('summary','','查看受影响文件'));const list=el('ul','impact-list');for(const path of plan.affected_files||[])list.append(el('li','',path));details.append(list);box.append(details);
 const label=el('label'),check=el('input');check.type='checkbox';label.append(check,el('span','','我已核对范围，确认直接写入'));box.append(label);m.body.append(box);return check;
}
export function modalKeyboard(event){
 const m=state.modal;if(!m)return;
 if(event.key==='Escape'){event.preventDefault();closeModal();return;}
 if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();m.save?.click();return;}
 if(event.key!=='Tab')return;
 const items=[...m.box.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(node=>node.getClientRects().length);
 if(!items.length){event.preventDefault();return;}const first=items[0],last=items[items.length-1];
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}