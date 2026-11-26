#!/usr/bin/env node
/* Package a locally matched batch for later review/apply. No network or DB operations. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),L=require('../horse-review-link'),M=require('../historical-review-matcher');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),arg=(k,f)=>{const i=args.indexOf(k);return i<0?f:args[i+1];},id=arg('--id','');
if(!/^batch-\d{3}$/.test(id))throw Error('Specify --id batch-NNN');
const matching=JSON.parse(fs.readFileSync(arg('--matching-plan'))),histories=JSON.parse(fs.readFileSync(arg('--histories'))),dir=path.join(root,'maintenance/historical-review-links'),dest=path.join(dir,id),registryPath=path.join(dir,'batches.json'),hash=raw=>crypto.createHash('sha256').update(raw).digest('hex');
if(fs.existsSync(dest))throw Error('Immutable batch already exists');
const registry=fs.existsSync(registryPath)?JSON.parse(fs.readFileSync(registryPath)):{schemaVersion:1,batches:[{id:'batch-001',plan:'maintenance/historical-review-links/plan.json',sha256:hash(fs.readFileSync(path.join(dir,'plan.json'))),completed:'maintenance/historical-review-links/completed.json',checkpoint:'.local/historical-review-links/checkpoint.json'}]};
if(registry.batches.some(b=>b.id===id))throw Error('Duplicate batch ID');
const sig=u=>JSON.stringify([u.horseName,u.original.name||'',u.original.track||'',u.original.eval||'',u.original.comment||'']),existing=new Set(),occupied=new Set();
for(const b of registry.batches)for(const u of JSON.parse(fs.readFileSync(path.join(root,b.plan))).updates){existing.add(sig(u));occupied.add(u.horseName+'|'+u.raceId);}
const originalHistories=registry.batches.flatMap(b=>JSON.parse(fs.readFileSync(path.join(path.dirname(path.join(root,b.plan)),'official-histories.json')))),oldNames=new Set(originalHistories.map(h=>h.name)),byName=new Map(histories.map(h=>[h.name,h])),manifest=JSON.parse(fs.readFileSync(path.join(root,'prediction-data/manifest.json'))),records=new Map(manifest.files.filter(f=>f.collection==='raceReviews').flatMap(f=>JSON.parse(fs.readFileSync(path.join(root,'prediction-data',f.path))).documents).map(r=>[r.raceId||r._docId,r]));
const accepted=[],rejected=[];
for(const u of matching.updates){
 if(existing.has(sig(u)))continue;
 const h=byName.get(u.horseName),r=h&&M.match(u.original,h,[{...u.raceRef,name:u.raceRef.raceName,raceId:u.raceId}]);
 let reason=null;
 if(!r||r.status!=='confirmed'||r.card.raceId!==u.raceId||h.url!==u.verification.url||r.official.date!==u.verification.officialDate||r.official.finish!==u.verification.officialFinish)reason='official-proof-not-reproducible';
 else if(occupied.has(u.horseName+'|'+u.raceId))reason='another-prepared-review-occupies-target';
 else if(records.has(u.raceId)&&L.contradictions({raceRef:u.raceRef,track:u.original.track},records.get(u.raceId)).length)reason='whole-review-metadata-conflict';
 if(reason){rejected.push({horse:u.horseName,run:u.original,status:reason,raceId:u.raceId,officialDate:u.verification.officialDate,wholeReviewRef:records.get(u.raceId)?.raceRef});continue;}
 accepted.push(u);existing.add(sig(u));occupied.add(u.horseName+'|'+u.raceId);
}
if(!accepted.length)throw Error('No new confirmed reviews to package');
const newHistories=histories.filter(h=>!oldNames.has(h.name)||accepted.some(u=>u.horseName===h.name)),newNames=new Set(newHistories.map(h=>h.name)),held=(matching.cases||[]).filter(c=>newNames.has(c.horse)&&c.status!=='confirmed').concat(rejected),counts={};held.forEach(c=>counts[c.status]=(counts[c.status]||0)+1);
const plan={schemaVersion:1,preparedAt:new Date().toISOString(),masterExportedAt:matching.report.masterExportedAt,updates:accepted},raw=JSON.stringify(plan),meta={id,preparedAt:plan.preparedAt,officialHistories:newHistories.length,completeOfficialHistories:newHistories.filter(h=>h.complete).length,confirmedHorses:new Set(accepted.map(u=>u.horseName)).size,confirmedReviews:accepted.length,heldReviews:held.length,heldReasons:counts,dbReads:0,dbWrites:0,planSha256:hash(raw),fullDatabaseMatchingComplete:false};
fs.mkdirSync(dest);fs.writeFileSync(path.join(dest,'plan.json'),raw);fs.writeFileSync(path.join(dest,'official-histories.json'),JSON.stringify(newHistories,null,2));fs.writeFileSync(path.join(dest,'held-cases.json'),JSON.stringify(held,null,2));fs.writeFileSync(path.join(dest,'status.json'),JSON.stringify(meta,null,2));
registry.batches.push({id,plan:'maintenance/historical-review-links/'+id+'/plan.json',sha256:hash(raw),checkpoint:'.local/historical-review-links/'+id+'/checkpoint.json'});fs.writeFileSync(registryPath,JSON.stringify(registry,null,2));console.log(JSON.stringify(meta,null,2));
