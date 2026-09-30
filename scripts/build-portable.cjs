#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const dependencies=require('./build-dependencies.cjs').resolveBuildDependencies(root);
const {modules,runtime}=dependencies;
const asar=require(path.join(modules,'@electron','asar'));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const version='3.0.0';
const editor=['app.py','launch.py','editor_core.py','message_edit.py','force_edit.py','writer_lock_cleanup.py','index.html','fixtures.py','editor.css','editor-api.js','editor-view.js','editor-dialog.js','editor-actions.js','editor.js'];
function inside(p){const q=path.resolve(p);if(!q.startsWith(root+path.sep))throw Error('Output escaped release: '+q);return q;}
function clean(p){inside(p);if(fs.existsSync(p)){if(fs.lstatSync(p).isSymbolicLink())throw Error('Refusing link: '+p);fs.rmSync(p,{recursive:true,force:false});}}
(async()=>{
 const args=process.argv.slice(2);const only=args.includes('--only')?args[args.indexOf('--only')+1]:null;
 if(only&&!['claude','codex'].includes(only))throw Error('Usage: --only claude|codex [--refresh]');
 require('./sync-prompts.cjs').sync('--check', { quiet: true });
 const {resedit}=await import(pathToFileURL(path.join(modules,'@electron','packager','dist','resedit.js')).href);
 for(const kind of only?[only]:['claude','codex']){
  const name=`cc-unlock-${kind}`,source=path.join(root,name),old=runtime;
  const output=inside(path.join(source,'dist',`${name}-win32-x64`)),stage=inside(path.join(root,'.build-stage-v3.0',kind));
  if(args.includes('--refresh')){clean(output);clean(stage);}
  if(fs.existsSync(output)||fs.existsSync(stage))throw Error('Build output exists; use --refresh for this release copy only.');
  fs.mkdirSync(output,{recursive:true});fs.mkdirSync(stage,{recursive:true});
  // Never inherit old deployment resources: runtime and payload have separate allowlists.
  for(const entry of fs.readdirSync(old)){if(entry!=='resources' && entry!=='electron.exe')fs.cpSync(path.join(old,entry),path.join(output,entry),{recursive:true,errorOnExist:true,force:false});}
  const files=['main.js','preload.js','deploy-core.js','backup-core.js','package.json','renderer/index.html','renderer/app.js','renderer/app.css'];
  if(kind==='codex')files.push('chat-editor-host.js','context-host.js','context-worker.js');
  for(const file of files){const dest=path.join(stage,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(source,file),dest);}
  // Include renderer modules rather than silently shipping only the entry file.
  for(const name of fs.readdirSync(path.join(source,'renderer'))){
   const src=path.join(source,'renderer',name);
   if(fs.statSync(src).isFile() && /\.(?:js|css|html)$/.test(name))fs.copyFileSync(src,path.join(stage,'renderer',name));
  }
  if(fs.existsSync(path.join(source,'assets')))fs.cpSync(path.join(source,'assets'),path.join(stage,'assets'),{recursive:true});
  const resources=path.join(output,'resources');fs.mkdirSync(resources);
  const archive=path.join(resources,'app.asar');await asar.createPackage(stage,archive);
  const mappings=kind==='claude'?[['cc-unlock-files/claude-config-bundle','claude-config-bundle']]:[['codex-files/codex-config-bundle','codex-files/codex-config-bundle']];
  mappings.push(['cc-unlock-files/skill-bundle','skill-bundle']);
  for(const [from,to] of mappings)fs.cpSync(path.join(root,from),path.join(resources,to),{recursive:true,errorOnExist:true,force:false});
  if(kind==='codex'){const out=path.join(resources,'chat-editor');fs.mkdirSync(out);for(const f of editor)fs.copyFileSync(path.join(source,'chat-editor',f),path.join(out,f));}
  const allowed=kind==='claude'?['app.asar','claude-config-bundle','skill-bundle']:['app.asar','chat-editor','codex-files','skill-bundle'];
  if(JSON.stringify(fs.readdirSync(resources).sort())!==JSON.stringify(allowed.sort()))throw Error('Unexpected resource payload');
  if(JSON.stringify(fs.readdirSync(path.join(resources,'skill-bundle')))!==JSON.stringify(['sec-forge']))throw Error('Unexpected skills');
  const integrity={algorithm:'SHA256',hash:crypto.createHash('sha256').update(asar.getRawHeader(archive).headerString).digest('hex')};
  const exe=path.join(output,name+'.exe');fs.copyFileSync(path.join(modules,'electron','dist','electron.exe'),exe);
  await resedit(exe,{productVersion:version,fileVersion:'3.0.0.0',productName:`cc-unlock for ${kind==='claude'?'Claude Code':'Codex'}`,iconPath:path.join(root,'assets','cc-unlock.ico'),win32Metadata:{FileDescription:`cc-unlock for ${kind==='claude'?'Claude Code':'Codex'}`,OriginalFilename:name+'.exe'},asarIntegrity:{'resources\\app.asar':integrity}});
  const pkg=JSON.parse(asar.extractFile(archive,'package.json').toString());if(pkg.version!==version)throw Error('Wrong app version');
  for(const f of files)if(!asar.extractFile(archive,f).equals(fs.readFileSync(path.join(source,f))))throw Error('ASAR mismatch '+f);
  const manifest={version,kind,exe,exeSha256:sha(exe),asarSha256:sha(archive),asarHeaderIntegrity:integrity,resources:allowed,editorIncluded:kind==='codex',noMemoryOrSubagentPayload:true};
  fs.writeFileSync(path.join(source,'PORTABLE_MANIFEST_v3.0.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify(manifest));
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
