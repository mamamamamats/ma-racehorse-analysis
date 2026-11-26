#!/usr/bin/env node
/* Offline preview by default; explicit --check-live reads, --apply writes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import Link from '../horse-review-link.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const base='https://firestore.googleapis.com/v1/projects/ma-racehorse-analysis/databases/(default)/documents';
const signature=r=>JSON.stringify([r.name||'',r.track||'',r.eval||'',r.comment||'']);
export const entryKey=u=>JSON.stringify([u.horseName,u.raceId,signature(u.original)]);
function decode(v){if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)]));if('arrayValue'in v)return (v.arrayValue.values||[]).map(decode);if('nullValue'in v)return null;for(const k of ['stringValue','timestampValue','booleanValue','integerValue','doubleValue'])if(k in v)return k==='integerValue'?Number(v[k]):v[k];return null;}
function encode(v){if(v==null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(encode)}};if(typeof v==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};if(typeof v==='boolean')return {booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};return {stringValue:String(v)};}
export function prepareHorse(raw,updates){
 const horse=Object.fromEntries(Object.entries(raw.fields||{}).map(([k,v])=>[k,decode(v)])),accepted=[],already=[],skipped=[];
 if(horse.deleted)return {accepted,already,skipped:updates.map(u=>({key:entryKey(u),reason:'deleted horse'})),write:null};
 if(!Array.isArray(horse.races)||!raw.updateTime)throw Error('Missing live races/updateTime');
 const races=horse.races.map(r=>({...r})),rawRaces=structuredClone(raw.fields.races);
 for(const u of updates){
  const found=races.map((r,i)=>signature(r)===signature(u.original)?i:-1).filter(i=>i>=0),key=entryKey(u);
  if(found.length!==1){skipped.push({key,reason:'review changed or duplicated'});continue;}
  const i=found[0],conflicts=Link.contradictions(races[i],{raceId:u.raceId,raceRef:u.raceRef});
  if(conflicts.length){skipped.push({key,reason:'live review metadata conflicts with prepared race',fields:conflicts});continue;}
  if(races[i].raceId){if(races[i].raceId===u.raceId)already.push(u);else skipped.push({key,reason:'different existing race ID'});continue;}
  if(races.some((r,j)=>j!==i&&r.raceId===u.raceId)){skipped.push({key,reason:'target race already has another review'});continue;}
  const fields=rawRaces.arrayValue.values[i].mapValue.fields;
  const preparedRef=encode(u.raceRef);preparedRef.mapValue.fields={...preparedRef.mapValue.fields,...(fields.raceRef?.mapValue?.fields||{})};
  fields.raceId=encode(u.raceId);fields.raceRef=preparedRef;fields.linkVerification=encode(u.verification);
  races[i]={...races[i],raceId:u.raceId};accepted.push(u);
 }
 return {accepted,already,skipped,write:accepted.length?{update:{name:raw.name,fields:{races:rawRaces}},updateMask:{fieldPaths:['races']},currentDocument:{updateTime:raw.updateTime},updateTransforms:[{fieldPath:'archiveUpdatedAt',setToServerValue:'REQUEST_TIME'}]}:null};
}
const py="import urllib.request,urllib.error,json,sys\np=sys.stdin.read()\nr=urllib.request.Request(sys.argv[1],data=p.encode() if p else None,headers={'Content-Type':'application/json'})\ntry:\n v=urllib.request.urlopen(r,timeout=50);print(json.dumps({'status':v.status,'data':json.load(v)}))\nexcept urllib.error.HTTPError as e: print(json.dumps({'status':e.code,'body':e.read().decode()}))";
async function request(url,payload){const c=spawn('python',['-c',py,url],{stdio:['pipe','pipe','pipe']});let out='',err='';c.stdout.on('data',d=>out+=d);c.stderr.on('data',d=>err+=d);c.stdin.end(payload?JSON.stringify(payload):'');await new Promise((ok,no)=>{c.on('error',no);c.on('close',code=>code?no(Error(err)):ok());});const v=JSON.parse(out);if(v.status<200||v.status>=300)throw Error('Firestore HTTP '+v.status+' '+(v.body||'').slice(0,300));return v.data;}
async function atomic(file,data){await fs.writeFile(file+'.tmp',JSON.stringify(data,null,2));await fs.rename(file+'.tmp',file);}
async function optional(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
export async function main(args=process.argv.slice(2),transport=request){
 const arg=(k,f)=>{const n=args.indexOf(k);return n<0?f:args[n+1];};
 const dir=path.join(root,'maintenance/historical-review-links'),planFile=path.resolve(arg('--plan',path.join(dir,'plan.json'))),out=path.resolve(arg('--backup-dir',path.join(root,'.local/historical-review-links'))),apply=args.includes('--apply'),check=args.includes('--check-live');
 if(apply&&check)throw Error('Use either --apply or --check-live');
 const bytes=await fs.readFile(planFile),plan=JSON.parse(bytes),hash=createHash('sha256').update(bytes).digest('hex');
 // The checked-in manifest pins the default queue; unrelated website changes cannot alter it.
 const isDefault=planFile===path.join(dir,'plan.json');
 if(isDefault){const manifest=JSON.parse(await fs.readFile(path.join(dir,'status.json'),'utf8'));if(hash!==manifest.planSha256)throw Error('Prepared plan hash mismatch');}
 const seed=isDefault?JSON.parse(await fs.readFile(path.join(dir,'completed.json'),'utf8')):{completed:[]};
 const checkpointFile=path.join(out,'checkpoint.json'),checkpoint=await optional(checkpointFile,{schemaVersion:1,planSha256:hash,completed:[]});
 if(checkpoint.planSha256!==hash)throw Error('Checkpoint belongs to another plan; use another --backup-dir');
 const completed=new Map([...seed.completed,...checkpoint.completed].map(u=>[entryKey(u),u])),groups=new Map();
 const updates=plan.updates||plan.links;if(!Array.isArray(updates))throw Error('Missing plan updates');
 for(const u of updates){if(!u.horseName||!u.raceId||!u.raceRef?.date||u.verification?.source!=='jra-official-history'||!/^https:\/\/www\.jra\.go\.jp\/JRADB\/accessU\.html\?/.test(u.verification.url||'')||!u.verification.evidence?.includes('app-starting-list'))throw Error('Unverified plan entry');if(completed.has(entryKey(u)))continue;if(!groups.has(u.horseName))groups.set(u.horseName,[]);groups.get(u.horseName).push(u);}
 const limit=Number(arg('--limit-horses',arg('--max-horses','200')));if(!Number.isInteger(limit)||limit<1)throw Error('Invalid horse limit');
 const result={mode:apply?'apply':check?'check-live':'offline-preview',planSha256:hash,plannedReviews:updates.length,knownCompletedReviews:updates.filter(u=>completed.has(entryKey(u))).length,pendingHorses:groups.size,pendingReviews:[...groups.values()].reduce((n,u)=>n+u.length,0),selectedHorses:Math.min(limit,groups.size),readHorses:0,savedHorses:0,linkedReviews:0,alreadyLinkedReviews:0,skipped:[],stopped:null};
 if(!apply&&!check){console.log(JSON.stringify(result,null,2));return result;}
 // A separate run directory keeps original backups, even after a retry or changed task.
 await fs.mkdir(out,{recursive:true});const run=await fs.mkdtemp(path.join(out,'run-'));result.backupDirectory=run;
 const saveCheckpoint=()=>atomic(checkpointFile,{schemaVersion:1,planSha256:hash,updatedAt:new Date().toISOString(),completed:[...completed.values()]});
 for(const [name,entries]of [...groups].slice(0,limit)){
  try{
   const raw=await transport(base+'/horses/'+encodeURIComponent(name));result.readHorses++;
   await fs.writeFile(path.join(run,encodeURIComponent(name)+'.before.json'),JSON.stringify(raw),{flag:'wx'});
   const prepared=prepareHorse(raw,entries);result.skipped.push(...prepared.skipped);result.alreadyLinkedReviews+=prepared.already.length;
   for(const u of prepared.already)completed.set(entryKey(u),{horseName:u.horseName,raceId:u.raceId,original:u.original});
   if(prepared.write&&apply){
    const response=await transport(base+':commit',{writes:[prepared.write]});
    await fs.writeFile(path.join(run,encodeURIComponent(name)+'.commit.json'),JSON.stringify({response,entries:prepared.accepted}),{flag:'wx'});
    for(const u of prepared.accepted)completed.set(entryKey(u),{horseName:u.horseName,raceId:u.raceId,original:u.original});
    result.savedHorses++;result.linkedReviews+=prepared.accepted.length;
   }
   if(check){result.readyReviews=(result.readyReviews||0)+prepared.accepted.length;}
   await saveCheckpoint();await atomic(path.join(run,'result.json'),result);
   console.log(`${result.mode}: read ${result.readHorses}, saved ${result.savedHorses} horses / ${result.linkedReviews} reviews`);
  }catch(e){result.stopped={name,error:e.message};await atomic(path.join(run,'result.json'),result);break;}
 }
 await atomic(path.join(run,'result.json'),result);console.log(JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().then(r=>{if(r.stopped)process.exitCode=1;}).catch(e=>{console.error(e.message);process.exitCode=1;});
