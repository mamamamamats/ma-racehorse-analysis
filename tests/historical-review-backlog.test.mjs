import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import M from '../historical-review-matcher.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=path.join(root,'maintenance/historical-review-links'),registry=JSON.parse(fs.readFileSync(path.join(base,'batches.json')));
test('all immutable batches validate and preview all pending entries offline from any directory',()=>{
 const result=spawnSync(process.execPath,[path.join(root,'scripts/preview-historical-review-backlog.mjs')],{cwd:'/tmp',encoding:'utf8'});assert.equal(result.status,0,result.stderr);const report=JSON.parse(result.stdout);
 assert.equal(report.dbReads,0);assert.equal(report.dbWrites,0);assert.equal(report.confirmedReviews,registry.batches.reduce((n,b)=>n+JSON.parse(fs.readFileSync(path.join(root,b.plan))).updates.length,0));assert.ok(report.pendingReviews>1233);
});
test('each newly packaged entry reproduces its unique official match, without duplicates or unverifiable URLs',()=>{
 const signatures=new Set();for(const batch of registry.batches){const bytes=fs.readFileSync(path.join(root,batch.plan));assert.equal(createHash('sha256').update(bytes).digest('hex'),batch.sha256);const plan=JSON.parse(bytes);
 const dir=path.dirname(path.join(root,batch.plan)),histories=JSON.parse(fs.readFileSync(path.join(dir,'official-histories.json'))),byName=new Map(histories.map(h=>[h.name,h]));
 for(const u of plan.updates){const signature=JSON.stringify([u.horseName,u.original.name,u.original.track,u.original.eval,u.original.comment]);assert.ok(!signatures.has(signature));signatures.add(signature);assert.match(u.verification.url,/^https:\/\/www\.jra\.go\.jp\/JRADB\/accessU\.html\?/);
 if(batch.id==='batch-001')continue;const r=M.match(u.original,byName.get(u.horseName),[{...u.raceRef,name:u.raceRef.raceName,raceId:u.raceId}]);assert.equal(r.status,'confirmed',u.horseName+' '+u.original.name);assert.equal(r.official.date,u.verification.officialDate);assert.equal(r.official.finish,u.verification.officialFinish);
 }
 }
});
