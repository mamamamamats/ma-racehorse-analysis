import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareHorse} from '../scripts/apply-historical-review-links.mjs';
const original={name:'1勝クラス',track:'東京芝2400',eval:'A',comment:'先行して2着。'};
const entry={horseName:'確認馬',original,raceId:'race-confirmed',raceRef:{date:'2026/1/1'},verification:{source:'jra-official-history'}};
const string=value=>({stringValue:value});
function raw(runs=[original]){
 const values=runs.map(r=>({mapValue:{fields:{
  ...Object.fromEntries(Object.entries(r).map(([k,v])=>[k,string(v)])),
  customTimestamp:{timestampValue:'2024-01-01T00:00:00Z'}
 }}}));
 return {
  name:'projects/test/databases/(default)/documents/horses/test',updateTime:'2026-01-01T00:00:00Z',
  fields:{name:string('確認馬'),other:{mapValue:{fields:{untouched:{timestampValue:'2025-01-01T00:00:00Z'}}}},races:{arrayValue:{values}}}
 };
}
test('rechecks latest review by content, keeps latest order and raw Firestore types, updates only races with precondition',()=>{
 const live=raw([{...original,name:'後から追加'},original]),before=JSON.stringify(live),result=prepareHorse(live,[entry]);
 assert.equal(result.accepted.length,1);assert.equal(JSON.stringify(live),before);
 assert.deepEqual(result.write.updateMask.fieldPaths,['races']);assert.deepEqual(result.write.currentDocument,{updateTime:live.updateTime});
 const values=result.write.update.fields.races.arrayValue.values;
 assert.equal(values[0].mapValue.fields.raceId,undefined);assert.equal(values[1].mapValue.fields.raceId.stringValue,entry.raceId);
 assert.deepEqual(values[1].mapValue.fields.customTimestamp,{timestampValue:'2024-01-01T00:00:00Z'});
 assert.equal(values[1].mapValue.fields.eval.stringValue,'A');assert.equal(values[1].mapValue.fields.comment.stringValue,original.comment);
 assert.deepEqual(Object.keys(result.write.update.fields),['races']);
});
test('rerun after commit or interrupted checkpoint does not produce a second write',()=>{
 const result=prepareHorse(raw([{...original,raceId:entry.raceId}]),[entry]);assert.equal(result.write,null);assert.equal(result.already.length,1);assert.equal(result.accepted.length,0);
});
test('changed reviews, duplicate text, other saved IDs, and an occupied target are held without writes',()=>{
 for(const runs of [[{...original,comment:'修正済み'}],[original,original],[{...original,raceId:'different'}],[original,{...original,name:'別回顧',raceId:entry.raceId}]]){
  const result=prepareHorse(raw(runs),[entry]);assert.equal(result.write,null);assert.equal(result.skipped.length,1);
 }
});
test('prepared default preview works from another directory without Firestore reads or writes',()=>{
 const script=fileURLToPath(new URL('../scripts/apply-historical-review-links.mjs',import.meta.url));
 const result=spawnSync(process.execPath,[script],{cwd:'/tmp',encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(result.stdout);assert.equal(report.mode,'offline-preview');assert.equal(report.readHorses,0);assert.equal(report.savedHorses,0);assert.equal(report.knownCompletedReviews,9);assert.equal(report.pendingReviews,1233);assert.equal(report.pendingHorses,97);
});
test('quota stops immediately; successful checkpoint survives retry and read-only check never commits',async()=>{
 const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path');
 const {main}=await import('../scripts/apply-historical-review-links.mjs');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'historical-links-test-'));
 try{
  const planFile=path.join(dir,'plan.json'),out=path.join(dir,'backups');
  const a={...entry,horseName:'A',verification:{source:'jra-official-history',url:'https://www.jra.go.jp/JRADB/accessU.html?CNAME=test',evidence:['app-starting-list']}},b={...a,horseName:'B',raceId:'race-B'};
  await fs.writeFile(planFile,JSON.stringify({updates:[a,b]}));
  const args=['--plan',planFile,'--backup-dir',out];let calls=[];
  const first=await main([...args,'--apply'],async(url,payload)=>{
   calls.push({url,payload});if(url.endsWith('/B'))throw Error('Firestore HTTP 429 RESOURCE_EXHAUSTED');
   return payload?{commitTime:'2026-01-01T00:00:01Z'}:raw();
  });
  assert.equal(first.savedHorses,1);assert.equal(first.linkedReviews,1);assert.equal(first.stopped.name,'B');assert.equal(calls.length,3);
  const oldBackup=await fs.readFile(path.join(first.backupDirectory,'A.before.json'),'utf8');
  calls=[];
  const check=await main([...args,'--check-live'],async(url,payload)=>{calls.push({url,payload});assert.equal(payload,undefined);return raw();});
  assert.equal(check.pendingHorses,1);assert.equal(check.knownCompletedReviews,1);assert.equal(check.readyReviews,1);assert.equal(check.savedHorses,0);assert.equal(calls.length,1);
  calls=[];
  const retry=await main([...args,'--apply'],async(url,payload)=>{calls.push({url,payload});return payload?{commitTime:'2026-01-01T00:00:02Z'}:raw();});
  assert.equal(retry.savedHorses,1);assert.equal(calls.length,2);assert.ok(calls[0].url.endsWith('/B'));
  assert.equal(await fs.readFile(path.join(first.backupDirectory,'A.before.json'),'utf8'),oldBackup);
  const offline=await main(args,()=>{throw Error('Unexpected network');});assert.equal(offline.pendingReviews,0);assert.equal(offline.knownCompletedReviews,2);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
