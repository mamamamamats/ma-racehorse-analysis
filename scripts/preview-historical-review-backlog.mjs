#!/usr/bin/env node
/* Offline inventory only. Never calls Firebase, HTTP, or the apply command. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {entryKey} from './apply-historical-review-links.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),registry=JSON.parse(await fs.readFile(path.join(root,'maintenance/historical-review-links/batches.json'),'utf8'));
const output={mode:'offline-preview-all-batches',dbReads:0,dbWrites:0,batches:[],confirmedReviews:0,completedReviews:0,pendingReviews:0};
const globalKeys=new Set(),pendingHorses=new Set();
for(const batch of registry.batches){
 const raw=await fs.readFile(path.join(root,batch.plan));if(createHash('sha256').update(raw).digest('hex')!==batch.sha256)throw Error('Plan hash mismatch: '+batch.id);
 const plan=JSON.parse(raw),entries=plan.updates,keys=new Set(entries.map(entryKey));if(entries.some(e=>globalKeys.has(entryKey(e))))throw Error('Duplicate review between batches: '+batch.id);entries.forEach(e=>globalKeys.add(entryKey(e)));
 const seed=batch.completed?JSON.parse(await fs.readFile(path.join(root,batch.completed),'utf8')).completed:[];
 let checkpoint;try{checkpoint=JSON.parse(await fs.readFile(path.join(root,batch.checkpoint),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(checkpoint&&checkpoint.planSha256!==batch.sha256)throw Error('Checkpoint mismatch: '+batch.id);
 const done=new Set([...seed,...(checkpoint?.completed||[])].map(entryKey));if([...done].some(k=>!keys.has(k)))throw Error('Completion entry is outside its plan');
 const pending=entries.filter(e=>!done.has(entryKey(e)));pending.forEach(e=>pendingHorses.add(e.horseName));
 output.batches.push({id:batch.id,confirmedReviews:entries.length,completedReviews:done.size,pendingReviews:pending.length,pendingHorses:new Set(pending.map(e=>e.horseName)).size,plan:batch.plan});
 output.confirmedReviews+=entries.length;output.completedReviews+=done.size;output.pendingReviews+=pending.length;
}
output.pendingHorses=pendingHorses.size;console.log(JSON.stringify(output,null,2));
