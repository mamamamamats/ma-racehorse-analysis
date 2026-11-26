#!/usr/bin/env node
/* Offline by default. Apply only verified immutable plans, stop at the first DB error. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import M from '../historical-review-matcher.js';
import L from '../horse-review-link.js';
import {main,entryKey} from './apply-historical-review-links.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),apply=args.includes('--apply'),idx=args.indexOf('--limit-horses'),limit=idx<0?200:Number(args[idx+1]);
if(!Number.isInteger(limit)||limit<1)throw Error('Invalid horse limit');
const pausePath=path.join(root,'maintenance/historical-review-links/db-write-pause.json');
if(apply&&!args.includes('--resume-after-error')){try{const pause=JSON.parse(await fs.readFile(pausePath,'utf8'));if(pause.paused)throw Error('DB operations paused after an earlier error; continue offline matching only');}catch(e){if(e.code!=='ENOENT')throw e;}}
const registry=JSON.parse(await fs.readFile(path.join(root,'maintenance/historical-review-links/batches.json'),'utf8'));
const prepared=[],global=new Set();
for(const b of registry.batches){
 const bytes=await fs.readFile(path.join(root,b.plan));
 if(createHash('sha256').update(bytes).digest('hex')!==b.sha256)throw Error('Plan hash mismatch: '+b.id);
 const plan=JSON.parse(bytes),histories=JSON.parse(await fs.readFile(path.join(root,path.dirname(b.plan),'official-histories.json'),'utf8')),byName=new Map(histories.map(h=>[h.name,h]));
 for(const u of plan.updates){
  const key=entryKey(u);if(global.has(key))throw Error('Duplicate prepared link');global.add(key);
  const h=byName.get(u.horseName),r=M.match(u.original,h,[{...u.raceRef,name:u.raceRef.raceName,raceId:u.raceId}]);
  if(!h||L.norm(h.name)!==L.norm(u.horseName)||r.status!=='confirmed'||r.card.raceId!==u.raceId||h.url!==u.verification.url||r.official.date!==u.verification.officialDate||r.official.finish!==u.verification.officialFinish||L.contradictions(u.original,{raceRef:u.raceRef}).length)throw Error('Official match no longer reproduces: '+b.id+' '+u.horseName);
 }
 prepared.push(b);
}
let lock;const lockPath=path.join(root,'.local/historical-review-links/queue.lock');
if(apply){await fs.mkdir(path.dirname(lockPath),{recursive:true});try{lock=await fs.open(lockPath,'wx');await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));}catch(e){if(e.code==='EEXIST')throw Error('Another queue run or an interrupted run owns queue.lock; inspect before resuming');throw e;}}
try{
 let remaining=limit;const results=[];
 for(const b of prepared){
  const result=await main(['--plan',path.join(root,b.plan),'--backup-dir',path.join(root,path.dirname(b.checkpoint)),'--limit-horses',String(remaining),...(apply?['--apply']:[])]);
  results.push({batch:b.id,...result});remaining-=apply?result.readHorses:result.selectedHorses;
  if(result.stopped){await fs.writeFile(pausePath,JSON.stringify({paused:true,stoppedAt:new Date().toISOString(),batch:b.id,reason:result.stopped,note:'Continue official-history preparation without DB reads or writes. Do not automatically retry.'},null,2));process.exitCode=1;break;}if(remaining<=0)break;
 }
 console.log(JSON.stringify({finishedAt:new Date().toISOString(),officialProofsRechecked:global.size,results},null,2));
}finally{if(lock){await lock.close();await fs.unlink(lockPath);}}
