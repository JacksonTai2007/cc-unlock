#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function run(cmd,args,options={}){const r=spawnSync(cmd,args,{encoding:'utf8',windowsHide:true,...options});if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);assert.equal(r.status,0,JSON.stringify(args));return r;}
if(process.argv[2]==='--codex-child'){
 const fixture=process.env.CC_TEST_FIXTURE,home=path.join(fixture,'home');assert.equal(path.resolve(os.homedir()),path.resolve(home));process.resourcesPath=path.join(fixture,'resources');
 const core=require(path.join(root,'cc-unlock-codex/deploy-core.js'));assert.equal(core.PATHS.CODEX_DIR,path.join(home,'.codex'));
 const sentinels=JSON.parse(fs.readFileSync(path.join(fixture,'sentinels.json'),'utf8'));let count=0;
 const check=(name,condition)=>{assert(condition,name);count++;console.log('PASS '+name)};
 const log=(kind,text)=>{if(kind==='fail')throw Error(text)};
 function untouched(){for(const [rel,base64] of Object.entries(sentinels)){if(rel.startsWith('.codex/config')||rel==='.codex/AGENTS.md'||rel==='.codex/system-prompt.md')continue;check('personal sentinel unchanged '+rel,fs.readFileSync(path.join(home,rel)).equals(Buffer.from(base64,'base64')))}}
 for(let i=0;i<2;i++){
  core.deployCodex({},log);
  for(const n of ['AGENTS.md','system-prompt.md'])check('deployed prompt '+n,fs.readFileSync(path.join(home,'.codex',n)).equals(fs.readFileSync(path.join(process.resourcesPath,'codex-files/codex-config-bundle',n))));
  check('selected model preserved',fs.readFileSync(path.join(home,'.codex/config.toml'),'utf8').includes('model = "user-model"'));
  untouched();
 }
 const result=core.restoreOriginal(log);check('restore succeeds',result.ok);
 for(const [rel,value] of Object.entries(sentinels))check('restored bytes '+rel,fs.readFileSync(path.join(home,rel)).equals(Buffer.from(value,'base64')));
 core.deployCodex({},log);core.uninstallCodex(log);untouched();
 check('memory payload export empty',core.MEMORY_FILES.length===0);
 fs.writeFileSync(path.join(fixture,'report.json'),JSON.stringify({status:'PASS',count,home,modelExecution:'NOT_RUN'},null,2));console.log('CODEX_MINIMAL_DEPLOY_PASS '+count);process.exit(0);
}
run(process.execPath,[path.join(__dirname,'test-claude-minimal-deploy.cjs')]);
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'ccunlock24-codex-')),home=path.join(fixture,'home'),resources=path.join(fixture,'resources');fs.mkdirSync(home,{recursive:true});
const values={
 '.codex/config.toml':'# user config\r\nmodel = "user-model"\r\nmodel_instructions_file = "user-prompt.md"\r\n',
 '.codex/AGENTS.md':'# USER AGENTS\n','.codex/system-prompt.md':'# USER SYSTEM\n',
 '.codex/memories/MEMORY.md':'PERSONAL INDEX','.codex/memories/memory_summary.md':'PERSONAL SUMMARY','.codex/memories/raw_memories.md':'PERSONAL RAW',
 '.codex/memories/rollout_summaries/personal.md':'PERSONAL ROLLOUT','.codex/sessions/synthetic.jsonl':'{"type":"fixture"}\n','.claude/settings.json':'{"fixture":true}\n'};
const sentinels={};for(const [rel,text] of Object.entries(values)){const p=path.join(home,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);sentinels[rel]=Buffer.from(text).toString('base64')};fs.writeFileSync(path.join(fixture,'sentinels.json'),JSON.stringify(sentinels));
fs.cpSync(path.join(root,'codex-files/codex-config-bundle'),path.join(resources,'codex-files/codex-config-bundle'),{recursive:true});
for(const rel of ['sec-forge/SKILL.md','sec-forge/android-reverse/SKILL.md','sec-forge/web-reverse/SKILL.md','sec-forge/win-reverse/SKILL.md']){const dst=path.join(resources,'skill-bundle',rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(root,'cc-unlock-files/skill-bundle',rel),dst)}
run(process.execPath,[__filename,'--codex-child'],{env:{...process.env,CC_TEST_FIXTURE:fixture,HOME:home,USERPROFILE:home}});
console.log('REPORT '+path.join(fixture,'report.json'));
