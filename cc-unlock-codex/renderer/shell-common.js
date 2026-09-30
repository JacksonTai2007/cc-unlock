'use strict';
window.CCUI=(()=>{
 const real=Boolean(window.ccAPI),$=selector=>document.querySelector(selector),$$=selector=>[...document.querySelectorAll(selector)];
 const api=window.ccAPI||{
  detect:async()=>({}),paths:async()=>({}),listWorkspaces:async()=>[],
  deploy:async()=>({ok:false,error:'浏览器预览不执行部署。请使用桌面工具。'}),uninstall:async()=>({ok:false,error:'浏览器预览不执行卸载。'}),
  verify:async()=>({ok:false,error:'浏览器预览不读取真实配置。'}),restore:async()=>({ok:false,error:'浏览器预览不执行恢复。'}),
  contextClean:async()=>({ok:false,error:'浏览器预览不操作真实对话。请使用桌面工具。'}),browse:async()=>null
 };
 const el=(tag,cls='',text)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
 function log(target,kind,text){const line=el('span','console__line log-'+({fail:'fail',warn:'warn',ok:'ok',done:'done',head:'head'}[kind]||'info'),({fail:'失败 · ',warn:'提示 · ',ok:'完成 · '}[kind]||'')+text);target.append(line);target.scrollTop=target.scrollHeight;}
 function tile(id,value,kind='',meta){const node=$(id);if(!node)return;node.textContent=value;node.className='tile__value '+kind;if(meta)node.parentElement.querySelector('.tile__meta').textContent=meta;}
 function page(name){$$('.nav__item').forEach(node=>{const active=node.dataset.page===name;node.classList.toggle('is-active',active);if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});$$('.page').forEach(node=>node.classList.toggle('is-active',node.id==='page-'+name));$('.main').classList.toggle('main--chat',name==='chat');}
 document.addEventListener('click',event=>{const anchor=event.target.closest('a[data-external]');if(!anchor)return;event.preventDefault();const url=anchor.href;if(api.openExternal)api.openExternal(url);else window.open(url,'_blank','noopener');});
 return {api,real,$,$$,el,log,tile,page};
})();