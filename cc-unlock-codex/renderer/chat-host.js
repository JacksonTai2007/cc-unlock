'use strict';
window.ChatHost=(()=>{
 const {api,real,$}=window.CCUI,host=$('#chatEditorHost'),status=$('#chatEditorStatus'),placeholder=$('#chatEditorPlaceholder'),retry=$('#btnChatEditorRetry');
 let active=false,request=0,ready=false,frame=0;
 const bounds=()=>{const r=host.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),width:Math.max(1,Math.round(r.width)),height:Math.max(1,Math.round(r.height))};};
 function message(state,text){status.dataset.state=state;status.textContent=text;host.setAttribute('aria-busy',String(state==='loading'));placeholder.textContent=state==='ready'?'':text;retry.hidden=state!=='error';}
 function hide(){if(!api.chatEditorHide)return;try{Promise.resolve(api.chatEditorHide()).catch(()=>{});}catch{}}
 function resize(){if(!active||!ready||frame)return;frame=requestAnimationFrame(async()=>{frame=0;if(!active||!ready||!api.chatEditorResize)return;const id=request;try{const result=await api.chatEditorResize(bounds());if(result?.ok===false)throw new Error(result.error||'尺寸同步失败');}catch(error){if(!active||id!==request)return;ready=false;hide();message('error','窗口同步失败：'+error.message);}});}
 async function open(){
  if(!active)return;const id=++request;ready=false;
  if(!real||!api.chatEditorOpen){message('error','浏览器预览不访问真实对话。请在桌面工具中打开编辑器。');retry.hidden=true;return;}
  message('loading','正在连接本地编辑服务…');
  try{
   const result=await api.chatEditorOpen(bounds());if(id!==request||!active){if(!active)hide();return;}
   if(!result?.ok)throw new Error(result?.code==='MISSING_PYTHON'?'需要 Python 3.10+，请安装并加入 PATH 后重新连接。':result?.error||'编辑器启动失败');
   ready=true;message('ready','本地连接已就绪 · 保存保留锁 · 不生成备份');resize();
  }catch(error){if(id!==request||!active)return;hide();message('error',error.message);}
 }
 function page(name){active=name==='chat';++request;ready=false;if(!active){hide();return;}requestAnimationFrame(open);}
 retry.addEventListener('click',open);window.addEventListener('resize',resize);window.addEventListener('beforeunload',hide);
 if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(resize);observer.observe(host);observer.observe(host.parentElement);}
 return {page};
})();