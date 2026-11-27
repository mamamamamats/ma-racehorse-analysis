import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('checkpoint refuses an active queue before touching completion records or receipts',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'review-checkpoint-'));
 try{
  const scripts=path.join(root,'scripts'),base=path.join(root,'maintenance/historical-review-links');
  fs.mkdirSync(scripts,{recursive:true});fs.mkdirSync(base,{recursive:true});
  fs.mkdirSync(path.join(root,'.local/historical-review-links'),{recursive:true});
  fs.copyFileSync(new URL('../scripts/checkpoint-historical-review-progress.mjs',import.meta.url),path.join(scripts,'checkpoint.mjs'));
  fs.writeFileSync(path.join(scripts,'apply-historical-review-links.mjs'),'export const entryKey=JSON.stringify;');
  const registry=JSON.stringify({batches:[{id:'unfinished',plan:'must-not-be-read.json'}]});
  fs.writeFileSync(path.join(base,'batches.json'),registry);
  fs.writeFileSync(path.join(root,'.local/historical-review-links/queue.lock'),JSON.stringify({pid:1234}));
  const result=spawnSync(process.execPath,[path.join(scripts,'checkpoint.mjs')],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Cannot checkpoint or archive receipts while a DB queue is active/);
  assert.equal(fs.readFileSync(path.join(base,'batches.json'),'utf8'),registry);
  assert.deepEqual(fs.readdirSync(base),['batches.json']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
