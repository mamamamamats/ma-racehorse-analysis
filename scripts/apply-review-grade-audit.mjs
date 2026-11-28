#!/usr/bin/env node
/* Explicit, frozen S-grade corrections only; never modifies uncertain candidates. */
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {request,encode,decode,atomic} from './apply-historical-review-links.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),base='https://firestore.googleapis.com/v1/projects/ma-racehorse-analysis/databases/(default)/documents';
export function prepare(raw,updates){
 if(!raw.updateTime||!raw.fields?.races)throw Error('Missing live reviews/updateTime');if(decode(raw.fields.deleted||{booleanValue:false}))throw Error('Horse deleted');
 const races=decode(raw.fields.races),next=structuredClone(raw.fields.races),accepted=[],skipped=[];
 const sig=r=>JSON.stringify([r.name||'',r.track||'',r.comment||'',r.eval||'']);
 for(const u of updates){if(u.status!=='apply'||u.original.eval!=='S'||!['A','B','C'].includes(u.proposedGrade))throw Error('Unapproved grade change');const indices=races.map((r,i)=>sig(r)===sig(u.original)?i:-1).filter(i=>i>=0);if(indices.length!==1){skipped.push({id:u.id,reason:'Latest review changed or ambiguous'});continue;}const i=indices[0];if(u.original.raceId&&races[i].raceId!==u.original.raceId){skipped.push({id:u.id,reason:'Race identity changed'});continue;}next.arrayValue.values[i].mapValue.fields.eval=encode(u.proposedGrade);accepted.push({...u,liveIndex:i});}
 return {accepted,skipped,write:accepted.length?{update:{name:raw.name,fields:{races:next}},updateMask:{fieldPaths:['races']},currentDocument:{updateTime:raw.updateTime},updateTransforms:[{fieldPath:'archiveUpdatedAt',setToServerValue:'REQUEST_TIME'}]}:null};
}
async function main(){
 const dir=path.join(root,'maintenance/review-grade-audit/20261129'),bytes=await fs.readFile(path.join(dir,'plan.json')),plan=JSON.parse(bytes),apply=process.argv.includes('--apply');if(createHash('sha256').update(await fs.readFile(path.join(root,plan.source))).digest('hex')!==plan.sourceSha256)throw Error('Source hash mismatch');
 if(!apply){console.log(JSON.stringify({mode:'offline-preview',reviews:plan.updates.length,horses:new Set(plan.updates.map(u=>u.horseName)).size}));return;}
 const pause=JSON.parse(await fs.readFile(path.join(root,'maintenance/historical-review-links/db-write-pause.json'),'utf8'));if(pause.paused)throw Error('DB paused');
 const lockPath=path.join(root,'.local/historical-review-links/queue.lock'),lock=await fs.open(lockPath,'wx');await lock.writeFile(JSON.stringify({pid:process.pid,task:'review-grade-audit',startedAt:new Date().toISOString()}));
 const run=await fs.mkdtemp(path.join(dir,'run-')),result={planSha256:createHash('sha256').update(bytes).digest('hex'),readHorses:0,savedHorses:0,changedReviews:0,skipped:[],stopped:null,finishedAt:null};
 try{const groups=new Map();for(const u of plan.updates){if(!groups.has(u.horseName))groups.set(u.horseName,[]);groups.get(u.horseName).push(u);}
 for(const [name,updates] of groups){try{const raw=await request(base+'/horses/'+encodeURIComponent(name));result.readHorses++;await fs.writeFile(path.join(run,encodeURIComponent(name)+'.before.json'),JSON.stringify(raw),{flag:'wx'});const prepared=prepare(raw,updates);result.skipped.push(...prepared.skipped);if(prepared.write){const response=await request(base+':commit',{writes:[prepared.write]});await fs.writeFile(path.join(run,encodeURIComponent(name)+'.commit.json'),JSON.stringify({response,accepted:prepared.accepted,write:prepared.write}),{flag:'wx'});result.savedHorses++;result.changedReviews+=prepared.accepted.length;}await atomic(path.join(run,'result.json'),result);}catch(e){result.stopped={horseName:name,error:e.message};await atomic(path.join(root,'maintenance/historical-review-links/db-write-pause.json'),{paused:true,stoppedAt:new Date().toISOString(),reason:result.stopped,note:'Stop all DB operations. No automatic retry.'});break;}}
 result.finishedAt=new Date().toISOString();await atomic(path.join(run,'result.json'),result);console.log(JSON.stringify({run,...result},null,2));
 }finally{await lock.close();await fs.unlink(lockPath);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
