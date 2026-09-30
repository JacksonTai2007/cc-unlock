'use strict';
const {api,real,$,$$,el,log,tile,page}=window.CCUI;let workspaces=[],running=false;
$$('.nav__item').forEach(button=>button.addEventListener('click',()=>page(button.dataset.page)));
const output=$('#console'),logLine=(kind,text)=>log(output,kind,text);
async function overview(){
 const env=await api.detect();
 if(!real){['#tCcVer','#tDeployed','#tSkills','#tClaude'].forEach(id=>tile(id,'预览'));$('#hdrMeta').textContent='v3.0-stable · 界面预览（不执行操作）';return;}
 tile('#tCcVer',env.ccInstalled?(env.ccVersion&&env.ccVersion!=='?'?env.ccVersion:'已检测'):'未检测',env.ccInstalled?'ok':'warn');
 tile('#tDeployed',String(env.deployedCount||0));tile('#tSkills',String(env.skillDirs||0),'','sec-forge');
 tile('#tClaude',env.claudeMd?'就绪':'缺失',env.claudeMd?'ok':'warn');
 $('#hdrMeta').textContent='v3.0-stable'+(env.ccVersion&&env.ccVersion!=='?'?' · Claude Code '+env.ccVersion:'');
}
async function paths(){const value=await api.paths();$('#pBundle').value=value.bundle||'';$('#pClaude').value=value.claudeDir||'';$('#pProjects').value=value.projects||'';}
function render(){
 const body=$('#wsBody');body.replaceChildren();$('#wsCount').textContent=workspaces.length+' 个';
 if(!workspaces.length){const row=el('tr'),cell=el('td','','没有检测到工作区。可填入自定义路径。');cell.colSpan=3;row.append(cell);body.append(row);return;}
 workspaces.forEach((ws,index)=>{
  const row=el('tr'),choice=el('td','col-cbx'),box=el('input');box.type='checkbox';box.dataset.idx=String(index);box.setAttribute('aria-label','选择 '+(ws.path||ws.name));choice.append(box);
  const path=el('td','path-cell',ws.path||ws.name),status=el('td','col-status');status.append(el('span','tag'+(ws.deployed?' tag--green':''),ws.deployed?'已部署':'未部署'));
  row.append(choice,path,status);body.append(row);
 });
}
async function list(){const data=await api.listWorkspaces();workspaces=Array.isArray(data)?data:[];render();}
const selected=()=>$$('#wsBody input:checked').map(node=>workspaces[Number(node.dataset.idx)]);
async function run(kind,targets){
 if(running)return;if(!targets.length){logLine('warn','先选择工作区，或填写自定义路径。');return;}
 if(['restore','uninstall'].includes(kind)&&!confirm((kind==='restore'?'恢复':'卸载')+' '+targets.length+' 个工作区中本工具管理的内容？'))return;
 running=true;const controls=$$('#page-deploy button');controls.forEach(node=>node.disabled=true);output.replaceChildren();
 try{
  const names=targets.map(value=>value.path||value.name||value),result=kind==='deploy'?await api.deploy(names,{},logLine):await api[kind](names,logLine);
  if(result?.ok===false)logLine('fail',result.error||'操作未完成，详情见日志。');await Promise.all([overview(),list()]);
 }catch(error){logLine('fail',error.message||String(error));}
 finally{running=false;controls.forEach(node=>node.disabled=false);}
}
$('#btnDeploySel').addEventListener('click',()=>{const custom=$('#customPath').value.trim();run('deploy',custom?[{path:custom}]:selected());});
$('#btnDeployAll').addEventListener('click',()=>run('deploy',workspaces));
$('#btnUninstSel').addEventListener('click',()=>run('uninstall',selected()));
$('#btnUninstAll').addEventListener('click',()=>run('uninstall',workspaces.filter(value=>value.deployed)));
$('#btnRestore').addEventListener('click',()=>run('restore',selected()));
$('#btnVerify').addEventListener('click',()=>{const targets=selected();run('verify',targets.length?targets:workspaces.filter(value=>value.deployed));});
$('#btnRefresh').addEventListener('click',async()=>{if(running)return;$('#btnRefresh').disabled=true;try{await list();logLine('info','工作区列表已刷新。');}catch(error){logLine('fail',error.message);}finally{$('#btnRefresh').disabled=false;}});
$('#btnBrowse').addEventListener('click',async()=>{try{const result=await api.browse();if(result)$('#customPath').value=result;}catch(error){logLine('fail',error.message);}});
Promise.all([overview(),paths(),list()]).catch(error=>logLine('fail','读取部署状态失败：'+error.message));