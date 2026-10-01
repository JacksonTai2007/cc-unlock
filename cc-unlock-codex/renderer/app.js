'use strict';
const {api,real,$,$$,log,tile,page}=window.CCUI;let actionRunning=false;
$$('.nav__item').forEach(button=>button.addEventListener('click',()=>{page(button.dataset.page);window.ChatHost.page(button.dataset.page);}));
const output=$('#console'),logLine=(kind,text)=>log(output,kind,text);
async function overview(){
 const env=await api.detect();
 if(!real){['#tCodex','#tSp','#tConfig','#tRelay','#tCfgBundle','#tSkills'].forEach(id=>tile(id,'预览'));$('#hdrMeta').textContent='v3.0.1-stable · 界面预览（不执行操作）';return;}
 tile('#tCodex',env.codexInstalled?(env.codexVersion&&env.codexVersion!=='?'?env.codexVersion:'已检测'):'未检测',env.codexInstalled?'ok':'warn');
 tile('#tSp',env.liveSp?'存在':'未部署',env.liveSp?'ok':'warn','资源文件；是否引用见配置');
 tile('#tConfig',env.cfgInstr?'引用 system prompt':env.configPresent?'保留当前配置':'尚无配置',env.cfgInstr?'ok':'','配置检测，不推断加载结果');
 tile('#tRelay',env.relayConfigured?'自定义 provider':'当前默认接入');
 tile('#tCfgBundle',env.spBundle&&env.agentsBundle?'就绪':'缺失',env.spBundle&&env.agentsBundle?'ok':'warn');
 tile('#tSkills',String(env.skillDirs||0),'','sec-forge；JIT 已写入主提示词');
 $('#hdrMeta').textContent='v3.0.1-stable'+(env.codexVersion&&env.codexVersion!=='?'?' · Codex '+env.codexVersion:'');
}
async function paths(){const value=await api.paths();$('#pCodex').value=value.codexDir||'';$('#pBundle').value=value.bundle||'';$('#pSkills').value=value.skills||'';}
function relay(){const on=$('#tglRelay').checked;['#relayUrl','#relayKey','#relayModel'].forEach(id=>$(id).disabled=!on);}
$('#tglRelay').addEventListener('change',relay);
function relayOptions(){
 if(!$('#tglRelay').checked)return {};const relayUrl=$('#relayUrl').value.trim();
 if(!/^https?:\/\//i.test(relayUrl))throw new Error('填写有效的 API 地址，或关闭自定义接入。');
 return {relayUrl,relayKey:$('#relayKey').value.trim(),relayModel:$('#relayModel').value.trim()};
}
async function run(kind){
 if(actionRunning)return;if(['restore','uninstall'].includes(kind)&&!confirm(kind==='restore'?'恢复首次部署前的配置？只处理本工具管理的内容。':'卸载本工具部署的 Codex 指令和技能？'))return;
 actionRunning=true;const controls=$$('#page-deploy button');controls.forEach(node=>node.disabled=true);output.replaceChildren();
 try{const result=kind==='deploy'?await api.deploy(relayOptions(),logLine):await api[kind](logLine);if(result?.ok===false)logLine('fail',result.error||'操作未完成，详情见日志。');if(kind!=='verify')await overview();}
 catch(error){logLine('fail',error.message||String(error));}
 finally{actionRunning=false;controls.forEach(node=>node.disabled=false);}
}
for(const[id,kind]of [['btnDeploy','deploy'],['btnVerify','verify'],['btnRestore','restore'],['btnUninstall','uninstall']])$('#'+id).addEventListener('click',()=>run(kind));
relay();Promise.all([overview(),paths()]).catch(error=>logLine('fail','读取本地状态失败：'+error.message));