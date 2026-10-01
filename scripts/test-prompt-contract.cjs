 'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function validate(){
 const mapping=require('./sync-prompts.cjs').sync('--check', { quiet: true });const texts=mapping.mappings.map(x=>fs.readFileSync(x.source,'utf8'));
 const [claude,codexSystem,codexAgents]=texts,checks=[];const check=(n,c)=>{assert(c,n);checks.push(n)};
 check('routine prompt sync returns no checksum',mapping.mappings.every(item=>!('sha256' in item)));
 check('user-supplied engineering prompt retained',claude.startsWith('# 工程分析工作笔记'));
 for(const h of ['收到任务立即进入 JIT harness 模式','样本分析','结构分析 / 解包 / 动态插桩','运行时 / 内存分析','接口测试 / 输入校验分析','续作、验证与回滚','交付物'])check('Claude section: '+h,claude.includes('## '+h));
 check('authorization is user context, not invented proof',claude.includes('用户声明')&&claude.includes('不编造文件'));
 check('scope file absence is not an execution gate',claude.includes('不存在时使用当前请求'));
 check('keyword-file fallback exists',claude.includes('没有该文件时'));
 check('evidence and hashes required',claude.includes('SHA256')&&claude.includes('NOT_RUN'));
 check('accurate task description preserved',claude.includes('不通过改名掩盖任务性质'));
 for(const name of ['sec-forge','android-reverse','web-reverse','win-reverse'])check('Claude skill route '+name,claude.includes(name));
 check('JIT in main prompt',claude.includes('M/P/A/F')&&claude.includes('success oracle')&&claude.includes('递归'));
 check('no blanket lab word mapping',!claude.includes('| 词 | 意思 |'));
 check('Codex routing retained',codexSystem.includes('Enter the JIT harness')&&codexAgents.includes('收到任务立即进入'));
 check('Codex verification budget in both carriers',codexSystem.includes('## Verification budget')&&codexAgents.includes('## 验证与输出预算'));
 check('No mandatory Codex hash bullet',!codexSystem.includes('   - SHA256')&&!codexAgents.includes('   - hash(SHA256)'));
 for(const rel of ['cc-unlock-files/memory-bundle','cc-unlock-files/system-prompt-bundle','cc-unlock-claude/bundle','codex-files/codex-memory-bundle','codex-files/codex-rollout-bundle','desktop'])check('retired payload absent: '+rel,!fs.existsSync(path.join(root,rel)));
 check('sec-forge still bundled',fs.statSync(path.join(root,'cc-unlock-files/skill-bundle/sec-forge/SKILL.md')).isFile());
 const main=fs.readFileSync(path.join(root,'cc-unlock-claude/main.js'),'utf8');
 check('no modified Desktop launcher',!main.includes('desktop-host')&&!main.includes('launchCustomDesktop'));
 check('no global settings deployment',!main.includes('core.deploySettings('));
 const result={status:'PASS',kind:'v3.0.1-stable-prompt-contract',count:checks.length,checks,modelBehaviorExecution:'NOT_RUN'};console.log(JSON.stringify(result,null,2));return result;
}
if(require.main===module){try{validate()}catch(e){console.error(e.stack);process.exitCode=1}}
module.exports={validate};
