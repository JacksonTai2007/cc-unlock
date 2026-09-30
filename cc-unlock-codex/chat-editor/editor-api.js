export const state={status:null,threads:[],activeId:null,detail:null,listRequest:0,detailRequest:0,modal:null,refreshing:false,stopped:false,drafts:new Map()};
export const $=id=>document.getElementById(id);
export const el=(tag,cls='',text)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
export function button(text,cls='btn',onClick){const node=el('button',cls,text);node.type='button';if(onClick)node.addEventListener('click',onClick);return node;}
export const textValue=value=>typeof value==='string'?value:JSON.stringify(value,null,2)??'';
export function date(value){if(!value)return '时间未知';const d=new Date(typeof value==='number'&&value<1e11?value*1000:value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString('zh-CN',{hour12:false});}
export const canWrite=()=>state.status?.write_allowed===true&&!state.status?.update_required;
export const writeHint=()=>state.status?.update_required?'后台代码已更新，请重新连接编辑服务；当前草稿保留。':state.status?.block_reason||'保存需要连接到可写的本地服务。';
export function loading(node,text='正在读取…'){node.setAttribute('aria-busy','true');node.replaceChildren(el('p','input-helper',text),el('div','skeleton'),el('div','skeleton'));}
export function toast(text,error=false){const item=el('div','toast'+(error?' error':''));const close=button('关闭','btn small',()=>item.remove());item.append(el('span','',text),close);$('toasts').append(item);setTimeout(()=>item.remove(),error?18000:8000);}
export async function api(path,data){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
 try{
  const response=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'X-Editor-Token':window.EDITOR_TOKEN,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)}),cache:'no-store',signal:controller.signal});
  let result;try{result=await response.json();}catch{throw new Error('本地服务未返回有效数据，请重新连接。');}
  if(!response.ok||result.error)throw new Error(result.error||'请求失败（HTTP '+response.status+'）');return result;
 }catch(error){
  if(error.name==='AbortError')throw new Error('请求超时。若已经提交保存，请刷新核对结果后再试。');
  if(error instanceof TypeError)throw new Error('无法连接本地服务。已输入的草稿保留；请恢复连接。');throw error;
 }finally{clearTimeout(timer);}
}