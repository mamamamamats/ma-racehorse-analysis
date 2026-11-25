#!/usr/bin/env node
/* Publish only a freshly read raceReviews snapshot, retaining other collections' cutoffs. */
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const input=process.argv[2];if(!input)throw Error('Pass a live backfill snapshot.json');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'prediction-data'),previous=JSON.parse(await fs.readFile(path.join(out,'manifest.json'),'utf8')),snapshot=JSON.parse(await fs.readFile(input,'utf8'));
if(!snapshot.startedAt||!Array.isArray(snapshot.records)||snapshot.records.length<(previous.counts.raceReviews||0)*.8)throw Error('Invalid or unexpectedly reduced snapshot');
if(snapshot.records.some(r=>!r._updateTime||!r._resourceName))throw Error('Only a live server snapshot is accepted');
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),groups=new Map(),files=previous.files.filter(f=>f.collection!=='raceReviews');
for(const r of snapshot.records){const {_updateTime,_resourceName,...record}=r,m=String(record.raceRef?.date||'').match(/(\d{4})[/-](\d{1,2})/),month=m?m[1]+'-'+m[2].padStart(2,'0'):'undated';if(!groups.has(month))groups.set(month,[]);groups.get(month).push(record);}
for(const [month,documents]of [...groups].sort()){documents.sort((a,b)=>String(a._docId||a.raceId).localeCompare(String(b._docId||b.raceId)));const body=canonical({schemaVersion:1,collection:'raceReviews',month,documents})+'\n',sha256=hash(body),rel='raceReviews/'+month+'-'+sha256.slice(0,16)+'.json';await fs.writeFile(path.join(out,rel),body);files.push({collection:'raceReviews',month,path:rel,sha256,count:documents.length,bytes:Buffer.byteLength(body)});}
files.sort((a,b)=>a.collection.localeCompare(b.collection)||a.month.localeCompare(b.month));
const manifest={...previous,files,counts:{...previous.counts,raceReviews:snapshot.records.length},exportedAt:new Date().toISOString(),collectionStartedAt:{...previous.collectionStartedAt,raceReviews:snapshot.startedAt},generation:hash(canonical(files))};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({raceReviews:snapshot.records.length,reviewCutoff:snapshot.startedAt,otherCutoff:previous.startedAt,generation:manifest.generation}));
