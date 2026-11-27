#!/usr/bin/env node
/* Persist local success checkpoints and rollback receipts. No DB or network access. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {entryKey} from './apply-historical-review-links.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=path.join(root,'maintenance/historical-review-links'),registry=JSON.parse(await fs.readFile(path.join(dir,'batches.json'),'utf8'));
const optional=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
if(await optional(path.join(root,'.local/historical-review-links/queue.lock'),null))throw Error('Cannot checkpoint or archive receipts while a DB queue is active');
for(const b of registry.batches){
 const planBytes=await fs.readFile(path.join(root,b.plan));if(createHash('sha256').update(planBytes).digest('hex')!==b.sha256)throw Error('Plan hash mismatch');
 const plan=JSON.parse(planBytes),allowed=new Set(plan.updates.map(entryKey)),seed=b.completed?await optional(path.join(root,b.completed),{completed:[]}):{completed:[]},cp=await optional(path.join(root,b.checkpoint),{planSha256:b.sha256,completed:[]});
 if(cp.planSha256!==b.sha256)throw Error('Checkpoint hash mismatch');
 const done=new Map([...seed.completed,...cp.completed].map(u=>[entryKey(u),u]));if([...done.keys()].some(k=>!allowed.has(k)))throw Error('Completion outside plan');
 b.completed=b.completed||path.join(path.dirname(b.plan),'completed.json');
 await fs.writeFile(path.join(root,b.completed),JSON.stringify({schemaVersion:1,planSha256:b.sha256,updatedAt:cp.updatedAt||seed.updatedAt||null,completed:[...done.values()]},null,2));
 const out=path.dirname(path.join(root,b.checkpoint)),runs=await fs.readdir(out).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
 for(const run of runs.filter(n=>n.startsWith('run-'))){
  const dest=path.join(root,path.dirname(b.plan),'receipts-'+run+'.json.gz');try{await fs.access(dest);continue;}catch(e){if(e.code!=='ENOENT')throw e;}
  const files=[];for(const file of (await fs.readdir(path.join(out,run))).filter(n=>n.endsWith('.json')))files.push({name:file,content:await fs.readFile(path.join(out,run,file),'utf8')});
  if(!files.length)continue;await fs.writeFile(dest,gzipSync(JSON.stringify({schemaVersion:1,batch:b.id,planSha256:b.sha256,files})),{flag:'wx'});
 }
}
await fs.writeFile(path.join(dir,'batches.json'),JSON.stringify(registry,null,2));
const repairDir=path.join(dir,'going-repair'),repairStatus=await optional(path.join(repairDir,'status.json'),null);
if(repairStatus){
 const bytes=await fs.readFile(path.join(repairDir,'plan.json'));
 if(createHash('sha256').update(bytes).digest('hex')!==repairStatus.planSha256)throw Error('Repair plan hash mismatch');
 const completed=await optional(path.join(repairDir,'completed.json'),{planSha256:repairStatus.planSha256,completed:[]});
 if(completed.planSha256!==repairStatus.planSha256)throw Error('Repair completion hash mismatch');
 for(const run of (await fs.readdir(repairDir)).filter(n=>n.startsWith('run-'))){
  const dest=path.join(repairDir,'receipts-'+run+'.json.gz');
  try{await fs.access(dest);continue;}catch(e){if(e.code!=='ENOENT')throw e;}
  const files=[];
  for(const name of (await fs.readdir(path.join(repairDir,run))).filter(n=>n.endsWith('.json')))
   files.push({name,content:await fs.readFile(path.join(repairDir,run,name),'utf8')});
  if(files.length)await fs.writeFile(dest,gzipSync(JSON.stringify({schemaVersion:1,planSha256:repairStatus.planSha256,files})),{flag:'wx'});
 }
}
console.log('Persisted completion records and immutable run receipts for '+registry.batches.length+' batches.');
