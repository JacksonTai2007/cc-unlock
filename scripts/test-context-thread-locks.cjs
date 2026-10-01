#!/usr/bin/env node
'use strict';
// All records, locks, process replies and write races are synthetic fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {fork}=require('node:child_process');
let corePath=path.resolve(__dirname,'../cc-unlock-codex/deploy-core.js'),work=os.tmpdir(),observe=false;
for(let i=2;i<process.argv.length;i++){
  if(process.argv[i]==='--observe')observe=true;
  else if(['--core','--work'].includes(process.argv[i])){const key=process.argv[i];assert(process.argv[i+1]);const value=path.resolve(process.argv[++i]);if(key==='--core')corePath=value;else work=value;}
  else throw Error('Unknown argument '+process.argv[i]);
}
const source=fs.readFileSync(corePath,'utf8');fs.mkdirSync(work,{recursive:true});
const run=fs.mkdtempSync(path.join(work,'ccunlock-context-v26-')),ID='11111111-1111-4111-8111-111111111111';
const instruction=['# Collaboration Mode: Default','You are now in Default mode','request_user_input availability','use the request_user_input tool only when it is listed','never use the request_user_input tool for permission requests','never write a multiple choice question as a textual assistant message'].join('\n');
const idleList='"System","4","Services","0","200 K"\r\n',activeList=idleList+'"Codex.exe","1234","Console","1","200 K"\r\n';
function inside(root,file){const rel=path.relative(root,path.resolve(file));return !path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep);}
function put(file,text='fixture'){assert(inside(run,file));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);return file;}
function fixture(name,faults={}){
  const root=path.join(run,name),home=path.join(root,'home'),codex=path.join(home,'.codex'),locks=path.join(codex,'thread-writer-locks');
  fs.mkdirSync(codex,{recursive:true});const events=[],logs=[],descriptors=new Map(),readCalls=new Map(),statCalls=new Map(),nativeWrites=new Map(),writeAttempts=new Map();let probes=0,shortDone=false;
  const guarded=new Proxy(fs,{get(target,prop){
    if(typeof target[prop]!=='function')return target[prop];
    const single=['existsSync','readdirSync','lstatSync','statSync','realpathSync','readFileSync','writeFileSync','mkdirSync','rmSync','unlinkSync','openSync'],pairs=['copyFileSync','renameSync'];
    const fdMethods=['fstatSync','readSync','writeSync','closeSync'];
    if(!single.includes(prop)&&!pairs.includes(prop)&&!fdMethods.includes(prop))return ()=>{throw Error('Unexpected filesystem method '+String(prop));};
    return (...args)=>{
      const descriptor=fdMethods.includes(prop),file=descriptor?descriptors.get(args[0]):String(args[0]);
      assert(file,'Unknown descriptor '+args[0]);
      if(descriptor)assert(inside(root,file));
      else for(const value of args.slice(0,pairs.includes(prop)?2:1)){
        assert(inside(root,value)||(prop==='lstatSync'&&inside(String(value),root)),'Blocked host access '+String(prop)+' '+value);
      }
      events.push({method:prop,file,destination:pairs.includes(prop)?String(args[1]):null,
        position:prop==='readSync'||prop==='writeSync'?args[4]:null,length:prop==='readSync'||prop==='writeSync'?args[3]:null});
      if(faults.failReadLocks&&prop==='readdirSync'&&path.resolve(file)===locks)throw Object.assign(Error('simulated lock read denial'),{code:'EACCES'});
      if(faults.failRemove&&['rmSync','unlinkSync'].includes(prop)&&path.basename(file)==='blocked.lock')throw Object.assign(Error('simulated lock sharing violation'),{code:faults.failRemoveCode||'EBUSY'});
      if(faults.failLockFileStat&&prop==='lstatSync'&&inside(locks,file)&&fs.lstatSync(file).isFile())throw Object.assign(Error('simulated legacy Windows live lock lstat denial'),{code:'EPERM'});
      if(faults.vanishBeforeUnlink&&prop==='unlinkSync'&&!faults.vanished){faults.vanished=true;target.unlinkSync(file);throw Object.assign(Error('simulated entry removed concurrently'),{code:'ENOENT'});}
      if(faults.failDirectory&&prop==='readdirSync'&&path.basename(file)==='blocked-dir')throw Object.assign(Error('simulated directory denial'),{code:'EACCES'});
      const affected=!faults.failPathName||path.basename(file)===faults.failPathName;
      if(affected&&faults.failOpenSession&&prop==='openSync'&&path.extname(file)==='.jsonl')throw Object.assign(Error('simulated session open denial'),{code:'EACCES'});
      if(affected&&faults.failReadSession&&['readFileSync','readSync'].includes(prop)&&path.extname(file)==='.jsonl')throw Object.assign(Error('simulated session read denial'),{code:'EACCES'});
      if(affected&&faults.failWriteSession&&prop==='writeSync'&&path.extname(file)==='.jsonl')throw Object.assign(Error('simulated session sharing violation'),{code:'EBUSY'});
      if(prop==='fstatSync'){
        const call=(statCalls.get(args[0])||0)+1;statCalls.set(args[0],call);
        if(faults.replaceBeforeValidate&&call===2){const old=fs.readFileSync(file);fs.renameSync(file,file+'.replaced');fs.writeFileSync(file,old);}
      }
      if(prop==='readSync'){
        if(affected&&faults.failVerificationRead&&(nativeWrites.get(args[0])||0)>0)throw Object.assign(Error('simulated verification read EIO'),{code:'EIO'});
        if(affected&&faults.failRollbackVerificationRead&&(nativeWrites.get(args[0])||0)>=2)throw Object.assign(Error('simulated rollback verification EIO'),{code:'EIO'});
        const call=(readCalls.get(args[0])||0)+1;readCalls.set(args[0],call);
        if(call===2&&affected&&faults.appendBeforeCompare)fs.appendFileSync(file,'{"type":"event_msg","payload":{"message":"concurrent fixture append"}}\n');
        if(call===2&&affected&&faults.changeBeforeCompare){const old=fs.readFileSync(file,'utf8');assert(old.includes('"ordinal":9'));fs.writeFileSync(file,old.replace('"ordinal":9','"ordinal":8'));}
        if(call===2&&affected&&faults.truncateBeforeCompare)fs.truncateSync(file,4);
      }
      if(prop==='writeSync'){
        const attempt=(writeAttempts.get(args[0])||0)+1;writeAttempts.set(args[0],attempt);
        if(affected&&faults.failRollbackWrite&&attempt>=2)throw Object.assign(Error('simulated rollback write EIO'),{code:'EIO'});
        if(affected&&faults.sameRowMetadataOnWrite&&!faults.metadataChanged){faults.metadataChanged=true;const old=fs.readFileSync(file,'utf8');assert(old.includes('fixture-model'));fs.writeFileSync(file,old.replace('fixture-model','updated-model'));}
        if(faults.appendOnWrite&&!faults.appended){faults.appended=true;fs.appendFileSync(file,'{"type":"event_msg","payload":{"message":"append between compare and write"}}\n');}
        if(faults.shortWrite&&!shortDone){shortDone=true;const length=Math.max(1,Math.floor(args[3]/3));const size=target.writeSync(args[0],args[1],args[2],length,args[4]);nativeWrites.set(args[0],(nativeWrites.get(args[0])||0)+1);if(faults.changeTokenAfterShort){const actual=fs.readFileSync(file);actual[args[4]+length-1]=0x58;fs.writeFileSync(file,actual);}return size;}
        const result=target[prop](...args);
        nativeWrites.set(args[0],(nativeWrites.get(args[0])||0)+1);
        if(affected&&faults.throwAfterWrite)throw Object.assign(Error('simulated write reported EIO after changing bytes'),{code:'EIO'});
        if(faults.changeLaterRecord&&!faults.changed){faults.changed=true;const old=fs.readFileSync(file,'utf8');assert(old.includes('"ordinal":10'));fs.writeFileSync(file,old.replace('"ordinal":10','"ordinal":11'));}
        return result;
      }
      const result=target[prop](...args);
      if(faults.replaceLockDirectory&&prop==='readdirSync'&&path.resolve(file)===locks&&!faults.directoryReplaced){faults.directoryReplaced=true;const nested=path.join(locks,'nested');fs.renameSync(nested,path.join(root,'original-nested'));fs.symlinkSync(path.join(root,'outside'),nested,process.platform==='win32'?'junction':'dir');}
      if(faults.replaceLockFileWithDirectory&&prop==='readdirSync'&&path.resolve(file)===locks&&!faults.fileReplaced){faults.fileReplaced=true;const changed=path.join(locks,'changed.lock');fs.unlinkSync(changed);fs.mkdirSync(changed);put(path.join(changed,'keep.txt'));}
      if(prop==='openSync'){descriptors.set(result,file);readCalls.set(result,0);statCalls.set(result,0);nativeWrites.set(result,0);writeAttempts.set(result,0);}
      if(prop==='closeSync')descriptors.delete(args[0]);
      return result;
    };
  }});
  const moduleVM={exports:{}};
  vm.runInNewContext(source,{module:moduleVM,exports:moduleVM.exports,__dirname:path.dirname(corePath),Buffer,process:{pid:process.pid,platform:'win32',env:{SystemRoot:'C:\\Windows'}},
    require:id=>{
      if(id==='fs')return guarded;if(id==='path')return path;if(id==='os')return {homedir:()=>home};if(id==='./backup-core')return {};
      if(id==='./lock-delete-state')return {probeLockDeleteState:files=>{
        if(faults.pendingProbeThrows)throw Error('simulated native status probe unavailable');
        return {supported:true,results:files.map(file=>({file,status:faults.pendingDeleteName===path.basename(file)?'delete-pending':'access-denied',ntstatus:faults.pendingDeleteName===path.basename(file)?'0xc0000056':'0xc0000022'})),failures:[]};
      }};
      if(id==='child_process')return {execFile(){throw Error('Unexpected process launch');},execFileSync(_exe,args){
        assert.deepEqual([...args],['/FO','CSV','/NH']);probes++;
        if(faults.processFailure)throw Object.assign(Error('simulated process probe denied'),{code:'EACCES'});
        return faults.processReplies?faults.processReplies[Math.min(probes-1,faults.processReplies.length-1)]:faults.active?activeList:idleList;
      }};throw Error('Unexpected require '+id);
    }
  },{filename:corePath});
  return {root,home,codex,locks,core:moduleVM.exports,events,logs,descriptors,processCalls:()=>probes,log:(kind,text)=>logs.push({kind,text})};
}
function seed(f,matched=true,name='rollout-'+ID+'.jsonl'){
  const record=JSON.stringify({type:'turn_context',ordinal:9,payload:{developer_instructions:matched?instruction:'ordinary fixture instruction',cwd:'fixture-project',model:'fixture-model',extra:{untouched:true}}})+'\n';
  const rollout=put(path.join(f.codex,'sessions',name),record),lock=put(path.join(f.locks,ID+'.lock'),'stale artifact without PID');
  const projection=put(path.join(f.codex,'thread_history_1.sqlite'),'keep=projection');
  put(projection+'-wal','keep=wal');put(projection+'-shm','keep=shm');
  return {record,rollout,lock,projection};
}
function unchangedProjection(s){for(const [suffix,value] of [['','keep=projection'],['-wal','keep=wal'],['-shm','keep=shm']])assert.equal(fs.readFileSync(s.projection+suffix,'utf8'),value);}
function assertNeutralized(s){assert.equal(fs.statSync(s.rollout).size,Buffer.byteLength(s.record));assert.equal(JSON.parse(fs.readFileSync(s.rollout,'utf8')).payload.developer_instructions,null);}
function observeResult(){
  const f=fixture('same-input-active',{active:true}),s=seed(f),result=f.core.cleanInjectedContext({clearStaleLocks:true},f.log);
  return {filesChanged:result.filesChanged,recordsNeutralized:result.recordsNeutralized,locksRemoved:result.threadWriterLocks.removed.length,
    rolloutUnchanged:fs.readFileSync(s.rollout,'utf8')===s.record,lockRetained:fs.existsSync(s.lock),projectionRetained:fs.existsSync(s.projection),
    status:result.status||'legacy-unspecified',diskOnly:result.diskOnly===true,currentContextUpdated:result.currentContextUpdated===true};
}
if(observe){console.log(JSON.stringify(observeResult(),null,2));process.exit(0);}
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
test('active Codex clears ALL lock folder files before context token edits',()=>{
  const f=fixture('active',{active:true}),s=seed(f);
  put(path.join(f.locks,'.hidden'));put(path.join(f.locks,'nested','active-format.lock'));put(path.join(f.locks,'not-a-lock-extension.bin'));
  const r=f.core.cleanInjectedContext({clearStaleLocks:true},f.log);
  assert(r.ok);assert.equal(r.status,'cleaned');assert.equal(r.writeState.status,'not-checked');assert.equal(f.processCalls(),0);assert.equal(r.threadWriterLocks.removed.length,4);assert.equal(r.threadWriterLocks.skipped,undefined);
  assertNeutralized(s);assert(!fs.existsSync(s.lock));unchangedProjection(s);assert.equal(f.descriptors.size,0);assert.equal(r.diskOnly,true);assert.equal(r.currentContextUpdated,false);
  assert(fs.statSync(f.locks).isDirectory());assert(fs.statSync(path.join(f.locks,'nested')).isDirectory());
  const removals=f.events.map((event,index)=>({event,index})).filter(item=>['rmSync','unlinkSync'].includes(item.event.method));
  const write=f.events.findIndex(event=>event.method==='writeSync');assert.equal(removals.length,4);assert(removals.every(item=>item.index<write));
});
test('unknown process state also removes every lock folder file before editing',()=>{
  for(const [index,faults] of [{processFailure:true},{processReplies:['not CSV']}].entries()){
    const f=fixture('unknown-'+index,faults),s=seed(f);put(path.join(f.locks,'nested','unknown-format.dat'));
    const r=f.core.cleanInjectedContext({clearStaleLocks:true});assert(r.ok);assert.equal(r.writeState.status,'not-checked');assert.equal(f.processCalls(),0);assert.equal(r.threadWriterLocks.removed.length,2);assert.equal(r.threadWriterLocks.skipped,undefined);
    assert(!fs.existsSync(s.lock));assert(!fs.existsSync(path.join(f.locks,'nested','unknown-format.dat')));assertNeutralized(s);unchangedProjection(s);
    const firstWrite=f.events.findIndex(event=>event.method==='writeSync');const deleted=f.events.map((event,index)=>({event,index})).filter(item=>['rmSync','unlinkSync'].includes(item.event.method));assert(deleted.every(item=>item.index<firstWrite));
  }
});
test('unreadable lock directory does not block session edits',()=>{
  const f=fixture('lock-read-denial',{failReadLocks:true}),s=seed(f),r=f.core.cleanInjectedContext({clearStaleLocks:true});
  assert(!r.ok);assert.equal(r.status,'partial');assert.equal(r.writeState.status,'not-checked');assert.equal(f.processCalls(),0);assert.equal(r.threadWriterLocks.failures.length,1);assert(fs.existsSync(s.lock));assertNeutralized(s);
});
test('malformed lock root retained while normal context fields clean',()=>{
  const f=fixture('lock-root-file');put(f.locks,'not-directory');const text=JSON.stringify({type:'turn_context',payload:{developer_instructions:instruction}});
  const file=put(path.join(f.codex,'sessions','rollout-fixture.jsonl'),text),r=f.core.cleanInjectedContext({clearStaleLocks:true});
  assert(!r.ok);assert.equal(r.status,'partial');assert.equal(r.threadWriterLocks.failures.length,1);assert.equal(r.filesChanged,1);assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).payload.developer_instructions,null);assert.equal(fs.readFileSync(f.locks,'utf8'),'not-directory');
});
test('explicit one-click removes folder files BEFORE positional context writes',()=>{
  const f=fixture('offline-order'),s=seed(f);put(path.join(f.locks,'.coordination.lock'));put(path.join(f.locks,'.hidden'));put(path.join(f.locks,'nested','unknown-format.lock'));
  const r=f.core.cleanInjectedContext({clearStaleLocks:true},f.log);assert(r.ok);assert.equal(r.threadWriterLocks.removed.length,4);assert.equal(r.recordsNeutralized,1);assert.equal(r.fieldsNeutralized,1);
  assertNeutralized(s);unchangedProjection(s);assert(fs.statSync(path.join(f.locks,'nested')).isDirectory());
  const deleted=f.events.findIndex(e=>['rmSync','unlinkSync'].includes(e.method)&&e.file===s.lock),written=f.events.findIndex(e=>e.method==='writeSync'&&e.file===s.rollout);
  assert(deleted>=0&&written>deleted);assert(!f.events.some(e=>['copyFileSync','writeFileSync','renameSync'].includes(e.method)&&e.file.endsWith('.jsonl')));
});
test('exact neighboring message bytes and non-target bytes on the same row retained',()=>{
  const f=fixture('multi-record'),escaped=JSON.stringify(instruction);
  const target='{ "type":"turn_context", "ordinal":8, "payload": {"developer_instructions":'+escaped+', "developerInstructions":'+escaped+',"model":"模型保留","extra":{"untouched":true}} }';
  const lines=['{ "type":"session_meta", "payload":{"id":"fixture","history_base":{"end_byte_offset":123}} }',
    '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"用户 fixture untouched"}]}}',target,
    '{  "type":"response_item", "payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"assistant fixture untouched"}]}}',
    'malformed synthetic line'];
  const before=lines.join('\r\n'),file=put(path.join(f.codex,'sessions','rollout-fixture.jsonl'),before),r=f.core.cleanInjectedContext({});
  assert(r.ok);assert.equal(r.fieldsNeutralized,2);assert.equal(r.recordsNeutralized,1);assert.equal(r.invalidJsonLines,1);
  const after=fs.readFileSync(file,'utf8').split('\r\n');assert.equal(after.length,lines.length);assert.equal(fs.statSync(file).size,Buffer.byteLength(before));
  for(const i of [0,1,3,4])assert.equal(after[i],lines[i]);
  const expected=target.replaceAll(escaped,'null'+' '.repeat(Buffer.byteLength(escaped)-4));assert.equal(after[2],expected);
  assert.equal(JSON.parse(after[2]).payload.model,'模型保留');assert.equal(r.lineageRepair.enabled,false);
});
test('multiple target records preserve all intervening rows and byte offsets',()=>{
  const f=fixture('many-records'),s=seed(f),context=JSON.parse(s.record);context.ordinal=10;
  const user='{ "type":"response_item", "payload":{"type":"message","role":"user","content":[{"text":"do not remove"}]}}\r\n';
  const tail='{"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"text":"retained"}]}}\n';
  const before=s.record+user+JSON.stringify(context)+'\n'+tail;fs.writeFileSync(s.rollout,before);const r=f.core.cleanInjectedContext({});
  assert(r.ok);assert.equal(r.recordsNeutralized,2);const after=fs.readFileSync(s.rollout);assert.equal(after.length,Buffer.byteLength(before));
  assert.equal(after.subarray(Buffer.byteLength(s.record),Buffer.byteLength(s.record+user)).toString(),user);assert(after.toString().endsWith(tail));
  const writes=f.events.filter(e=>e.method==='writeSync');assert.equal(writes.length,2);const tokenStart=Buffer.byteLength(s.record.slice(0,s.record.indexOf(JSON.stringify(instruction))));assert.equal(writes[0].position,tokenStart);const secondText=JSON.stringify(context);assert.equal(writes[1].position,Buffer.byteLength(s.record+user)+Buffer.byteLength(secondText.slice(0,secondText.indexOf(JSON.stringify(instruction)))));for(const write of writes)assert.equal(write.length,Buffer.byteLength(JSON.stringify(instruction)));
});
test('developer messages retain structure and quoted user/assistant fields never match',()=>{
  const f=fixture('developer-message'),quoted=role=>JSON.stringify({type:'response_item',payload:{type:'message',role,developer_instructions:instruction,content:[{type:'input_text',text:instruction}]}});
  const user=quoted('user'),assistant=quoted('assistant'),target=JSON.stringify({type:'response_item',ordinal:2,payload:{type:'message',role:'developer',content:[{type:'input_text',text:instruction},{type:'input_text',text:'other text preserved'}],custom:'keep'}});
  const file=put(path.join(f.codex,'sessions','rollout-fixture.jsonl'),[user,target,assistant].join('\n')),r=f.core.cleanInjectedContext({});
  const lines=fs.readFileSync(file,'utf8').split('\n');assert.equal(lines[0],user);assert.equal(lines[2],assistant);const changed=JSON.parse(lines[1]);
  assert.equal(changed.payload.role,'developer');assert.equal(changed.payload.custom,'keep');assert.equal(changed.payload.content[0].text,'');assert.equal(changed.payload.content[1].text,'other text preserved');assert.equal(r.fieldsNeutralized,1);
});
test('no context match still clears all requested lock files without touching conversations',()=>{
  const f=fixture('no-match',{active:true}),s=seed(f,false),r=f.core.cleanInjectedContext({clearStaleLocks:true});
  assert(r.ok);assert.equal(r.status,'no-match');assert.equal(r.filesChanged,0);assert.equal(r.threadWriterLocks.removed.length,1);assert(!fs.existsSync(s.lock));assert.equal(fs.readFileSync(s.rollout,'utf8'),s.record);unchangedProjection(s);
});
test('lock deletion failures are reported but do not stop context edits',()=>{
  const f=fixture('lock-remove-failure',{failRemove:true}),s=seed(f);put(path.join(f.locks,'blocked.lock'));
  const r=f.core.cleanInjectedContext({clearStaleLocks:true},f.log);assert(!r.ok);assert.equal(r.status,'partial');assert.equal(r.filesChanged,1);assert.equal(r.failures.length,1);
  assert(fs.existsSync(path.join(f.locks,'blocked.lock')));assertNeutralized(s);assert(!f.logs.some(e=>e.kind==='done'));
});
test('legacy Windows lstat denial on ordinary live lock files does not prevent direct unlink',()=>{
  const f=fixture('legacy-lock-lstat',{active:true,failLockFileStat:true}),s=seed(f);
  const locks=[s.lock,put(path.join(f.locks,'nested','live.lock')),put(path.join(f.locks,'other.dat'))];
  const r=f.core.cleanInjectedContext({clearStaleLocks:true},f.log);
  assert(r.ok);assert.equal(r.threadWriterLocks.removed.length,3);assert.equal(r.threadWriterLocks.failures.length,0);assertNeutralized(s);
  for(const lock of locks){assert(!fs.existsSync(lock));assert(!f.events.some(event=>event.method==='lstatSync'&&event.file===lock));}
  const writes=f.events.findIndex(event=>event.method==='writeSync');const unlinks=f.events.map((event,index)=>({event,index})).filter(item=>item.event.method==='unlinkSync');
  assert.equal(unlinks.length,3);assert(unlinks.every(item=>item.index<writes));assert(!f.events.some(event=>event.method==='rmSync'));
});
test('genuine unlink EPERM is reported with stage and code while independent context edits continue',()=>{
  const f=fixture('unlink-permission',{active:true,failRemove:true,failRemoveCode:'EPERM'}),s=seed(f),blocked=put(path.join(f.locks,'blocked.lock'));
  const r=f.core.cleanInjectedContext({clearStaleLocks:true},f.log);assert.equal(r.status,'partial');assert.equal(r.threadWriterLocks.removed.length,1);
  const failure=r.threadWriterLocks.failures[0];assert.equal(failure.file,blocked);assert.equal(failure.stage,'unlink');assert.equal(failure.code,'EPERM');assert(fs.existsSync(blocked));assertNeutralized(s);
  assert(f.logs.some(entry=>entry.kind==='fail'&&entry.text.includes('[unlink/EPERM]')));assert(!f.events.some(event=>event.method==='rmSync'));
});
test('directory entry replaced by junction after enumeration never traverses external target',()=>{
  const f=fixture('lock-directory-race',{replaceLockDirectory:true}),s=seed(f),outside=put(path.join(f.root,'outside','keep.txt'));
  put(path.join(f.locks,'nested','nested.lock'));const r=f.core.cleanInjectedContext({clearStaleLocks:true});
  assert.equal(r.status,'partial');assert.equal(r.threadWriterLocks.failures.length,1);assert.equal(r.threadWriterLocks.failures[0].stage,'validate-directory');
  assert.equal(fs.readFileSync(outside,'utf8'),'fixture');assert(fs.existsSync(path.join(f.root,'original-nested','nested.lock')));assertNeutralized(s);
  assert(!f.events.some(event=>event.method==='readdirSync'&&event.file===path.join(f.locks,'nested')));
});
test('ordinary file entry replaced by directory cannot trigger recursive removal',()=>{
  const f=fixture('lock-file-directory-race',{replaceLockFileWithDirectory:true}),s=seed(f);put(path.join(f.locks,'changed.lock'));
  const r=f.core.cleanInjectedContext({clearStaleLocks:true});assert.equal(r.status,'partial');assert.equal(r.threadWriterLocks.failures.length,1);assert.equal(r.threadWriterLocks.failures[0].stage,'unlink');
  assert(fs.existsSync(path.join(f.locks,'changed.lock','keep.txt')));assert(fs.statSync(path.join(f.locks,'changed.lock')).isDirectory());assertNeutralized(s);
  assert(!f.events.some(event=>event.method==='readdirSync'&&event.file===path.join(f.locks,'changed.lock')));assert(!f.events.some(event=>event.method==='rmSync'));
});
test('concurrently vanished entry is not falsely counted as deleted by this action',()=>{
  const f=fixture('vanished-lock',{vanishBeforeUnlink:true}),s=seed(f),r=f.core.cleanInjectedContext({clearStaleLocks:true});
  assert(r.ok);assert.equal(r.threadWriterLocks.removed.length,0);assert.equal(r.threadWriterLocks.failures.length,0);assert(!fs.existsSync(s.lock));assertNeutralized(s);
});
test('context one-click invokes no process scanner before requested file deletion',()=>{
  const f=fixture('writer-started',{processReplies:[idleList,activeList]}),s=seed(f),r=f.core.cleanInjectedContext({clearStaleLocks:true});
  assert(r.ok);assert.equal(r.filesChanged,1);assert.equal(r.threadWriterLocks.removed.length,1);assert.equal(r.threadWriterLocks.skipped,undefined);assert(!fs.existsSync(s.lock));assertNeutralized(s);assert.equal(f.processCalls(),0);
});
test('concurrent append before compare is retained while context still edits',()=>{
  const f=fixture('append-compare',{active:true,appendBeforeCompare:true}),s=seed(f),r=f.core.cleanInjectedContext({});
  assert(r.ok);assert.equal(r.filesChanged,1);const after=fs.readFileSync(s.rollout,'utf8');assert.equal(JSON.parse(after.split('\n')[0]).payload.developer_instructions,null);assert(after.includes('concurrent fixture append'));
});
test('append between last comparison and positional write is never truncated',()=>{
  const f=fixture('append-on-write',{appendOnWrite:true}),s=seed(f),r=f.core.cleanInjectedContext({});
  assert(r.ok);assert.equal(r.filesChanged,1);assert(fs.readFileSync(s.rollout,'utf8').includes('append between compare and write'));unchangedProjection(s);
  assert(!f.events.some(e=>['copyFileSync','writeFileSync','renameSync'].includes(e.method)&&e.file.endsWith('.jsonl')));
});
test('changed target row is skipped and another independent file still cleans',()=>{
  const f=fixture('change-before',{changeBeforeCompare:true,failPathName:'rollout-a.jsonl'}),s=seed(f,true,'rollout-a.jsonl');
  const second=put(path.join(f.codex,'sessions','rollout-z.jsonl'),s.record.replace('"ordinal":9','"ordinal":10'));
  const originalRead=fs.readFileSync;
  const r=f.core.cleanInjectedContext({});assert.equal(r.status,'partial');assert.equal(r.skippedChangedDuringScan.length,1);assert.equal(r.filesChanged,1);
  assert.equal(JSON.parse(originalRead(s.rollout,'utf8')).payload.developer_instructions,instruction);assert.equal(JSON.parse(originalRead(second,'utf8')).payload.developer_instructions,null);
});
test('changed later target retains earlier committed row without wiping neighboring messages',()=>{
  const f=fixture('change-later',{changeLaterRecord:true}),s=seed(f),second=s.record.replace('"ordinal":9','"ordinal":10');
  const middle='{"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"text":"keep middle"}]}}\n';
  fs.writeFileSync(s.rollout,s.record+middle+second);const r=f.core.cleanInjectedContext({});assert.equal(r.status,'partial');assert.equal(r.recordsNeutralized,1);assert.equal(r.filesChanged,1);
  const after=fs.readFileSync(s.rollout,'utf8').split('\n');assert.equal(JSON.parse(after[0]).payload.developer_instructions,null);assert.equal(after[1]+'\n',middle);assert.equal(JSON.parse(after[2]).payload.developer_instructions,instruction);assert.equal(JSON.parse(after[2]).ordinal,11);
});
test('session replacement and truncation are detected before a write',()=>{
  for(const [index,faults] of [{replaceBeforeValidate:true},{truncateBeforeCompare:true}].entries()){
    const f=fixture('replaced-'+index,faults),s=seed(f),r=f.core.cleanInjectedContext({});assert.equal(r.status,'partial');assert.equal(r.filesChanged,0);assert.equal(r.skippedChangedDuringScan.length,1);
    assert(!f.events.some(e=>e.method==='writeSync'));unchangedProjection(s);
  }
});
test('source open/read/write failures preserve record and other files continue',()=>{
  for(const fault of ['failOpenSession','failReadSession','failWriteSession']){
    const f=fixture(fault,{[fault]:true,failPathName:'rollout-a.jsonl'}),s=seed(f,true,'rollout-a.jsonl'),second=put(path.join(f.codex,'sessions','rollout-z.jsonl'),s.record);
    const r=f.core.cleanInjectedContext({},f.log);assert(!r.ok);assert.equal(r.status,'partial');assert.equal(r.filesChanged,1);assert.equal(r.failures.length,1);
    assert.equal(fs.readFileSync(s.rollout,'utf8'),s.record);assert.equal(JSON.parse(fs.readFileSync(second,'utf8')).payload.developer_instructions,null);unchangedProjection(s);assert.equal(f.descriptors.size,0);
  }
});
test('short positional write restores only the known partial token and verifies it',()=>{
  const f=fixture('short-write',{shortWrite:true}),s=seed(f),r=f.core.cleanInjectedContext({});assert(!r.ok);assert.equal(r.filesChanged,0);assert.equal(r.failures.length,1);assert.equal(fs.readFileSync(s.rollout,'utf8'),s.record);assert.equal(f.descriptors.size,0);assert.equal(r.rollbacks.verified,1);assert.equal(r.uncertainWriteCount,0);assert.equal(r.requiresReload,true);
  const writes=f.events.filter(event=>event.method==='writeSync');assert.equal(writes.length,2);assert.equal(writes[0].position,writes[1].position);for(const write of writes)assert.equal(write.length,Buffer.byteLength(JSON.stringify(instruction)));
});
test('successful write with failed verification read is reported as possibly changed',()=>{
  const f=fixture('unverified-success',{active:true,failVerificationRead:true}),s=seed(f),r=f.core.cleanInjectedContext({},f.log);
  assert.equal(r.status,'partial');assert.equal(r.filesChanged,0);assert.equal(r.fieldsNeutralized,0);assert.equal(r.filesPossiblyChanged,1);assert.equal(r.uncertainWriteCount,1);
  assert.equal(r.uncertainWrites[0].phase,'verify');assert.equal(r.uncertainWrites[0].rollbackStatus,'not-attempted');assert.equal(r.requiresReload,true);
  assert.equal(JSON.parse(fs.readFileSync(s.rollout,'utf8')).payload.developer_instructions,null);assert(fs.existsSync(s.lock));unchangedProjection(s);assert.equal(f.descriptors.size,0);
  assert(f.logs.some(entry=>entry.kind==='warn'&&entry.text.includes('可能已修改')));assert(!f.logs.some(entry=>entry.kind==='done'));
});
test('unrelated same-row metadata changed between compare and write is not overwritten',()=>{
  const f=fixture('same-row-race',{sameRowMetadataOnWrite:true}),s=seed(f),r=f.core.cleanInjectedContext({});
  assert(r.ok);assert.equal(r.uncertainWriteCount,0);const after=fs.readFileSync(s.rollout,'utf8');assert.equal(JSON.parse(after).payload.model,'updated-model');assertNeutralized(s);
  const escaped=JSON.stringify(instruction),expected=s.record.replace('fixture-model','updated-model').replace(escaped,'null'+' '.repeat(Buffer.byteLength(escaped)-4));assert.equal(after,expected);
  const writes=f.events.filter(event=>event.method==='writeSync');assert.equal(writes.length,1);assert.equal(writes[0].length,Buffer.byteLength(escaped));assert.equal(writes[0].position,Buffer.byteLength(s.record.slice(0,s.record.indexOf(escaped))));
});
test('metadata race after first token yields truthful partial row counts without overwriting it',()=>{
  const f=fixture('same-row-two-tokens',{sameRowMetadataOnWrite:true}),s=seed(f),record=JSON.parse(s.record);record.payload.developerInstructions=instruction;
  fs.writeFileSync(s.rollout,JSON.stringify(record)+'\n');const r=f.core.cleanInjectedContext({});assert.equal(r.status,'partial');assert.equal(r.recordsNeutralized,0);assert.equal(r.recordsPartiallyNeutralized,1);assert.equal(r.fieldsNeutralized,1);assert.equal(r.filesChanged,1);
  const after=JSON.parse(fs.readFileSync(s.rollout,'utf8'));assert.equal(after.payload.model,'updated-model');assert.equal(after.payload.developer_instructions,null);assert.equal(after.payload.developerInstructions,instruction);assert.equal(r.requiresReload,true);
});
test('write throwing after changing bytes is not falsely reported unchanged',()=>{
  const f=fixture('write-uncertain',{throwAfterWrite:true}),s=seed(f),r=f.core.cleanInjectedContext({});
  assert.equal(r.status,'partial');assert.equal(r.filesChanged,0);assert.equal(r.filesPossiblyChanged,1);assert.equal(r.uncertainWriteCount,1);assert.equal(r.uncertainWrites[0].phase,'write');assert.equal(r.uncertainWrites[0].bytesWritten,null);assert.equal(r.requiresReload,true);
  assert.equal(JSON.parse(fs.readFileSync(s.rollout,'utf8')).payload.developer_instructions,null);unchangedProjection(s);
});
test('short write with changed token refuses rollback and preserves the concurrent token',()=>{
  const f=fixture('rollback-refused',{shortWrite:true,changeTokenAfterShort:true}),s=seed(f),r=f.core.cleanInjectedContext({});
  assert.equal(r.status,'partial');assert.equal(r.rollbacks.verified,0);assert.equal(r.rollbacks.refused,1);assert.equal(r.uncertainWriteCount,1);assert.equal(r.uncertainWrites[0].rollbackStatus,'refused-concurrent-token-change');assert.equal(r.requiresReload,true);
  assert.equal(f.events.filter(event=>event.method==='writeSync').length,1);assert.equal(fs.statSync(s.rollout).size,Buffer.byteLength(s.record));unchangedProjection(s);
});
test('failed short-write rollback stays unverified and requires reload',()=>{
  const f=fixture('rollback-write-failed',{shortWrite:true,failRollbackWrite:true}),s=seed(f),r=f.core.cleanInjectedContext({});
  assert.equal(r.status,'partial');assert.equal(r.rollbacks.verified,0);assert.equal(r.rollbacks.unverified,1);assert.equal(r.uncertainWriteCount,1);assert.equal(r.filesPossiblyChanged,1);assert.equal(r.uncertainWrites[0].rollbackStatus,'unverified');assert.equal(r.requiresReload,true);unchangedProjection(s);
});
test('rollback with failed read-back is not claimed restored even if disk later looks original',()=>{
  const f=fixture('rollback-read-failed',{shortWrite:true,failRollbackVerificationRead:true}),s=seed(f),r=f.core.cleanInjectedContext({});
  assert.equal(r.status,'partial');assert.equal(r.rollbacks.verified,0);assert.equal(r.rollbacks.unverified,1);assert.equal(r.uncertainWriteCount,1);assert.equal(r.requiresReload,true);assert.equal(fs.readFileSync(s.rollout,'utf8'),s.record);unchangedProjection(s);
});
test('unreadable session directory does not prevent another directory cleaning',()=>{
  const f=fixture('directory-denial',{failDirectory:true}),s=seed(f);put(path.join(f.codex,'sessions','blocked-dir','rollout-blocked.jsonl'),s.record);
  const r=f.core.cleanInjectedContext({});assert.equal(r.status,'partial');assert.equal(r.filesChanged,1);assert.equal(r.failures.length,1);assertNeutralized(s);
});
test('custom roots never delete global locks or alter other sessions',()=>{
  const f=fixture('custom-roots',{active:true}),s=seed(f),file=put(path.join(f.root,'custom','rollout-custom.jsonl'),s.record);
  const r=f.core.cleanInjectedContext({roots:[path.dirname(file)],clearStaleLocks:true});assert(r.ok);assert.equal(r.recordsNeutralized,1);assert.equal(r.threadWriterLocks.skipped,'custom-roots');assert(fs.existsSync(s.lock));assert.equal(fs.readFileSync(s.rollout,'utf8'),s.record);
});
test('linked lock root retained without following external target; context still cleans',()=>{
  const f=fixture('lock-root-link'),external=path.join(f.root,'outside');put(path.join(external,'keep.txt'));
  fs.symlinkSync(external,f.locks,process.platform==='win32'?'junction':'dir');const file=put(path.join(f.codex,'sessions','rollout-fixture.jsonl'),JSON.stringify({type:'turn_context',payload:{developer_instructions:instruction}})+'\n');
  const r=f.core.cleanInjectedContext({clearStaleLocks:true});assert(!r.ok);assert.equal(r.status,'partial');assert.equal(r.threadWriterLocks.failures.length,1);assert.equal(r.filesChanged,1);assert(fs.existsSync(path.join(external,'keep.txt')));assert(fs.lstatSync(f.locks).isSymbolicLink());
});
test('alternate user HOME determines lock root without a personal hardcoded path',()=>{
  const f=fixture('alternate-profile-name',{processFailure:true}),s=seed(f);
  assert.equal(f.core.PATHS.HOME,f.home);assert.equal(f.core.PATHS.CODEX_DIR,path.join(f.home,'.codex'));
  assert.equal(f.core.PATHS.THREAD_WRITER_LOCKS_DIR,path.join(f.home,'.codex','thread-writer-locks'));
  const r=f.core.cleanInjectedContext({clearStaleLocks:true});assert(r.ok);assert.equal(r.threadWriterLocks.removed[0],s.lock);assertNeutralized(s);assert(!fs.existsSync(s.lock));
});
test('nested lock links are removed without following or deleting external targets',()=>{
  const f=fixture('nested-lock-link',{active:true}),s=seed(f),external=path.join(f.root,'outside');put(path.join(external,'keep.txt'));
  fs.symlinkSync(external,path.join(f.locks,'linked'),process.platform==='win32'?'junction':'dir');
  const r=f.core.cleanInjectedContext({clearStaleLocks:true});assert(r.ok);assert.equal(r.threadWriterLocks.removed.length,2);assert(!fs.existsSync(path.join(f.locks,'linked')));assert(fs.existsSync(path.join(external,'keep.txt')));assert(fs.statSync(f.locks).isDirectory());assertNeutralized(s);
});
test('session directory links are rejected and unrelated sessions still clean',()=>{
  const f=fixture('session-link'),s=seed(f),external=path.join(f.root,'outside');const linked=put(path.join(external,'rollout-linked.jsonl'),s.record);
  fs.symlinkSync(external,path.join(f.codex,'sessions','linked'),process.platform==='win32'?'junction':'dir');const r=f.core.cleanInjectedContext({});assert.equal(r.status,'partial');assert.equal(r.filesChanged,1);
  assert.equal(fs.readFileSync(linked,'utf8'),s.record);assertNeutralized(s);
});
test('linked ancestor is never opened for positional editing',()=>{
  const f=fixture('ancestor-link'),external=path.join(f.root,'outside');const file=put(path.join(external,'sessions','rollout-linked.jsonl'),JSON.stringify({type:'turn_context',payload:{developer_instructions:instruction}})+'\n'),before=fs.readFileSync(file);
  fs.symlinkSync(external,path.join(f.root,'linked-home'),process.platform==='win32'?'junction':'dir');const r=f.core.cleanInjectedContext({roots:[path.join(f.root,'linked-home','sessions')]});
  assert.equal(r.status,'partial');assert.equal(r.filesChanged,0);assert(!f.events.some(e=>e.method==='openSync'));assert.deepEqual(fs.readFileSync(file),before);
});
test('linked .codex ancestor is not traversed or used for lock deletion',()=>{
  const f=fixture('codex-ancestor-link'),external=path.join(f.root,'outside');
  fs.renameSync(f.codex,f.codex+'.original');
  const record=JSON.stringify({type:'turn_context',payload:{developer_instructions:instruction}})+'\n';
  const file=put(path.join(external,'sessions','rollout-linked.jsonl'),record),lock=put(path.join(external,'thread-writer-locks','external.lock'));
  fs.symlinkSync(external,f.codex,process.platform==='win32'?'junction':'dir');
  const r=f.core.cleanInjectedContext({clearStaleLocks:true});assert.equal(r.status,'partial');assert.equal(r.filesChanged,0);assert.equal(r.writeState.status,'not-checked');assert.equal(f.processCalls(),0);
  assert.equal(fs.readFileSync(file,'utf8'),record);assert(fs.existsSync(lock));assert(!f.events.some(e=>e.method==='openSync'));assert(!f.events.some(e=>e.method==='readdirSync'&&e.file.includes('sessions')));
});
test('multiple hardlinks are rejected instead of changing an unrelated alias',()=>{
  const f=fixture('hardlink'),s=seed(f),alias=path.join(f.root,'alias.jsonl');fs.linkSync(s.rollout,alias);const r=f.core.cleanInjectedContext({});assert.equal(r.status,'partial');assert.equal(r.filesChanged,0);assert.equal(fs.readFileSync(alias,'utf8'),s.record);
});
test('legacy repairLineage request never repairs lineage or touches SQLite',()=>{
  const f=fixture('lineage-disabled'),s=seed(f),r=f.core.cleanInjectedContext({repairLineage:true});assert(r.ok);assert.equal(r.lineageRepair.enabled,false);assert.equal(r.lineageRepair.fixed,0);assert.equal(r.lineageRepair.skipped,'disabled-during-context-cleanup');unchangedProjection(s);
});
test('native-confirmed delete pending is separate from removed and true failure',()=>{
  const f=fixture('native-delete-pending',{failRemove:true,pendingDeleteName:'blocked.lock'}),s=seed(f);put(path.join(f.locks,'blocked.lock'));
  const r=f.core.cleanInjectedContext({clearStaleLocks:true});
  assert(r.ok);assert.equal(r.threadWriterLocks.removed.length,1);assert.equal(r.threadWriterLocks.pendingDeletion.length,1);
  assert.equal(r.threadWriterLocks.failures.length,0);assert(fs.existsSync(path.join(f.locks,'blocked.lock')));
  assert.equal(r.filesEnumerated,1);assert.equal(r.filesScanned,1);assert.equal(r.scanStarted,true);assert.equal(r.scanCompleted,true);
  assert.equal(r.contextStatus,'cleaned');assert.equal(r.contextFailures.length,0);assertNeutralized(s);
});
test('genuine native access denial does not become pending or context failure',()=>{
  const f=fixture('native-access-denied',{failRemove:true}),s=seed(f);put(path.join(f.locks,'blocked.lock'));
  const r=f.core.cleanInjectedContext({clearStaleLocks:true});assert.equal(r.status,'partial');assert.equal(r.threadWriterLocks.pendingDeletion.length,0);
  assert.equal(r.threadWriterLocks.failures.length,1);assert.equal(r.contextStatus,'cleaned');assert.equal(r.contextFailures.length,0);assertNeutralized(s);
});
test('native classification unavailable never hides the deletion error',()=>{
  const f=fixture('native-probe-unavailable',{failRemove:true,pendingProbeThrows:true}),s=seed(f);put(path.join(f.locks,'blocked.lock'));
  const r=f.core.cleanInjectedContext({clearStaleLocks:true});assert.equal(r.status,'partial');assert.equal(r.threadWriterLocks.failures.length,1);
  assert.equal(r.threadWriterLocks.pendingDeletion.length,0);assert.equal(r.threadWriterLocks.stateProbeFailures.length,1);assertNeutralized(s);
});
test('default roots include both sessions and archived history in visible counts',()=>{
  const f=fixture('enumerated-counts'),s=seed(f,false);put(path.join(f.codex,'archived_sessions','nested','rollout-archived.jsonl'),s.record);
  put(path.join(f.codex,'sessions','not-a-rollout.txt'),'ordinary input');
  const r=f.core.cleanInjectedContext({});assert.equal(r.filesEnumerated,2);assert.equal(r.filesScanned,2);assert.equal(r.contextStatus,'no-match');
  assert.equal(r.scanCompleted,true);assert.equal(r.contextFailures.length,0);assert.equal(r.threadWriterLocks.removed.length,0);
});
test('scan remains read-only even while Codex active',()=>{
  const f=fixture('scan',{active:true}),s=seed(f),r=f.core.scanInjectedContext({},f.log);assert(r.ok);assert.equal(r.recordsMatched,1);assert(fs.existsSync(s.lock));assert.equal(fs.readFileSync(s.rollout,'utf8'),s.record);unchangedProjection(s);
});
async function workerTest(){
  const home=path.join(run,'worker','home'),file=put(path.join(home,'.codex','sessions','rollout-worker.jsonl'),JSON.stringify({type:'turn_context',payload:{developer_instructions:instruction}})+'\n'),before=fs.readFileSync(file);
  const child=fork(path.join(path.dirname(corePath),'context-worker.js'),[],{env:{...process.env,HOME:home,USERPROFILE:home},stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});const messages=[];
  const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();reject(Error('worker timed out'));},15000);
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('message',message=>{messages.push(message);if(message.type==='ready')child.send({action:'context-scan',requestId:'worker-fixture',opts:{}});
      if(message.type==='error'){clearTimeout(timer);reject(Error(message.error));}if(message.type==='result'){clearTimeout(timer);resolve(message.result);}});
    child.on('exit',code=>{if(code&&!messages.some(m=>m.type==='result')){clearTimeout(timer);reject(Error('worker exit '+code));}});
  });
  assert(result.ok);assert.equal(result.recordsMatched,1);assert(messages.some(m=>m.type==='progress'));assert.deepEqual(fs.readFileSync(file),before);count++;console.log('PASS separate worker protocol with disposable HOME');
}
workerTest().then(()=>console.log('RESULT '+count+'/'+count+' PASS; synthetic HOME only; no live cleanup')).catch(error=>{console.error(error.stack||error);process.exitCode=1;});
