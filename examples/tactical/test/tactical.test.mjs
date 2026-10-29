import {fileURLToPath} from 'node:url';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {validateTicket,submitReviewedTicket} from '../ticket.mjs';
const source=fileURLToPath(new URL('..',import.meta.url));const good=fs.readFileSync(source+'/tickets/passing.md','utf8');
const lint=(file,level='suggestion')=>spawnSync('vale',['--config',source+'/.vale.ini','--minAlertLevel='+level,'--output=JSON',file],{encoding:'utf8',timeout:10000});
const alerts=result=>Object.values(JSON.parse(result.stdout||'{}')).flat();
test('ticket parser distinguishes structure from semantic approval',()=>{assert.equal(validateTicket(good).valid,true);assert.equal(validateTicket(good.replace(/A timed-out request displays a timeout status\./,'Works correctly.')).valid,true);assert.equal(validateTicket(good).semanticReviewRequired,true);});
test('ticket failures: missing/empty/duplicate headings, forbidden sections, TODO and heading in code',()=>{
 for(const s of [good.replace('## Acceptance criteria','## Wrong heading'),good.replace('## Problem','## Expected outcome'),good.replace(/## Problem[\s\S]*?## Expected outcome/,'## Problem\n<!-- comment only -->\n\n## Expected outcome'),good+'\n## Forbidden\ntext',good+'\n[[TODO: missing fact]]',good.replace('## Acceptance criteria','```text\n## Acceptance criteria\n```')])assert.equal(validateTicket(s).valid,false);
});
test('Vale 3.24.0: TODO error, stock phrase warning, passing prose and literal code policy',()=>{
 const version=spawnSync('vale',['--version'],{encoding:'utf8'});assert.match(version.stdout,/3\.24\.0/);
 const todo=lint(source+'/fixtures/todo.md');assert.notEqual(todo.status,0);assert.ok(alerts(todo).some(a=>a.Check==='SPCA.UnresolvedTODO'&&a.Severity==='error'));
 const stock=lint(source+'/fixtures/stock.md');assert.ok(alerts(stock).some(a=>a.Check==='SPCA.EmptyPhrases'&&a.Severity==='warning'));
 assert.equal(lint(source+'/fixtures/stock.md','error').status,0);assert.equal(lint(source+'/tickets/passing.md').status,0);
 assert.ok(alerts(lint(source+'/fixtures/code-example.md')).some(a=>a.Check==='SPCA.UnresolvedTODO'));
});
test('local mock adapter: no approval, failed create, and persistence mismatch do not report success',async()=>{
 const payload={title:validateTicket(good).title,description:good,project:'synthetic-project',assignee:'synthetic-owner'};let stored;
 const mock={create:async p=>{stored=p;return {id:'fixture-1'};},read:async()=>stored};
 await assert.rejects(submitReviewedTicket(mock,payload),/Human approval/);
 assert.deepEqual(await submitReviewedTicket(mock,payload,{humanApproved:true}),{id:'fixture-1',verified:true});
 let calls=0;await assert.rejects(submitReviewedTicket({create:async()=>{calls++;throw new Error('simulated');}},payload,{humanApproved:true}),/unresolved/);assert.equal(calls,1);
 await assert.rejects(submitReviewedTicket({...mock,read:async()=>({...stored,description:'altered'})},payload,{humanApproved:true}),/Persistence mismatch/);
});
test('PostToolUse handler: actual fixture edits yield pass/error feedback; failures are not silent approvals',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'spca-hook-'));
 try{
  fs.cpSync(source,root,{recursive:true});const file=path.join(root,'tickets/edited.md');
  const invoke=(input,env={})=>spawnSync(process.execPath,[path.join(root,'vale-hook.mjs')],{input:typeof input==='string'?input:JSON.stringify(input),encoding:'utf8',env:{...process.env,...env},timeout:15000});
  const event={hook_event_name:'PostToolUse',session_id:'synthetic',cwd:root,tool_name:'Write',tool_input:{file_path:file},tool_response:{filePath:file,type:'create'}};
  fs.writeFileSync(file,good);assert.equal(invoke(event).status,0);
  fs.writeFileSync(file,good+'\n[[TODO: Still unresolved despite a completion claim.]]');let result=invoke(event);assert.equal(result.status,2);assert.match(result.stderr,/SPCA.UnresolvedTODO/);assert.match(result.stderr,/edit already occurred/);assert.ok(fs.readFileSync(file,'utf8').includes('TODO'));
  assert.equal(invoke('{broken').status,2);assert.equal(invoke(event,{SPCA_VALE_BIN:'/missing/vale'}).status,2);
  assert.equal(invoke({...event,tool_input:{file_path:path.join(root,'missing.md')}}).status,2);
  assert.equal(invoke({...event,tool_name:'Bash'}).status,0);
  const check=spawnSync(process.execPath,[path.join(source,'check.mjs'),path.join(root,'tickets')],{encoding:'utf8'});assert.notEqual(check.status,0);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

