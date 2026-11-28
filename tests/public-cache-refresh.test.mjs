import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const helpers=html.slice(html.indexOf('function publicCacheTime('),html.indexOf('async function fetchGitHubData('));
const env={};vm.runInNewContext(helpers,env);
const exportedAt='2026-11-27T15:00:48.103Z';
const latest={name:'エンペラーズソード',races:[{name:'国立特別',eval:'B'}]};
test('published horse corrects stale rating and recovers empty review cache',()=>{
 for(const races of [[],[{name:'国立特別',eval:'A'}]]){
  const rows=env.publicCacheUpdates([latest],[{name:latest.name,races}],'name',exportedAt);
  assert.equal(rows.length,1);assert.equal(rows[0].races[0].eval,'B');assert.equal(rows[0]._publicSnapshotAt,exportedAt);
 }
});
test('newer edits, verified DB reads, timestamps and snapshots survive older public export',()=>{
 for(const key of ['_localSavedAt','_dbVerifiedAt','_publicSnapshotAt','archiveUpdatedAt']){
  const row={...latest,[key]:'2026-11-27T16:00:00Z'};
  assert.equal(env.publicCacheUpdates([latest],[row],'name',exportedAt).length,0);
 }
 const row={...latest,archiveUpdatedAt:{seconds:Date.parse('2026-11-27T16:00:00Z')/1000}};
 assert.equal(env.publicCacheUpdates([latest],[row],'name',exportedAt).length,0);
});
test('repeated opening avoids writes, missing records restored and extra local horses retained',()=>{
 const rows=env.publicCacheUpdates([latest],[],'name',exportedAt);
 assert.equal(rows.length,1);
 assert.equal(env.publicCacheUpdates([latest],[...rows,{name:'ローカルのみ'}],'name',exportedAt).length,0);
 assert.equal(env.publicCacheUpdates([latest],[{...latest,races:[]}],'name',null).length,0);
});
test('public startup repairs existing rows without Firestore calls and commits version after writes',async()=>{
 const writes=[],storage=[];
 const e={isEditMode:false,_fetchPayload:async()=>({exportedAt,horses:[latest],raceDays:[]}),idbGetAll:async s=>s==='horses'?[{name:latest.name,races:[]}]:[],getDeletedHorseNames:()=>new Set(),idbPutAll:async(s,rows)=>writes.push([s,rows]),localStorage:{setItem:(...args)=>storage.push(args)},GITHUB_DATA_VERSION_KEY:'version',invalidateHorseCache:()=>{},console};
 vm.runInNewContext(helpers+html.slice(html.indexOf('async function fetchGitHubData('),html.indexOf('\nfunction exportData()')),e);
 await e.fetchGitHubData();assert.equal(writes[0][1][0].races[0].eval,'B');assert.equal(storage.length,1);
 e.isEditMode=true;await e.fetchGitHubData();assert.equal(writes.length,1);
});
test('review loader reads archive before Firebase gate; pending badges are not labeled unregistered',async()=>{
 const e={window:{DataArchive:{read:async()=>[{raceId:'new-race'}]}},raceConditionReviewPromise:null,raceConditionReviewRecords:null,raceConditionReviewError:'',raceConditionRefreshPanels:()=>{},horseRaceRefreshEventBadges:()=>{},waitForFirebase:async()=>{throw Error('should not be called before archive');}};
 vm.runInNewContext(html.slice(html.indexOf('async function raceConditionLoadReviews('),html.indexOf('function raceConditionAnalysisBody(')),e);
 await e.raceConditionLoadReviews();assert.equal(e.raceConditionReviewRecords[0].raceId,'new-race');assert.equal(e.raceConditionReviewError,'');
 Object.assign(e,{horseRaceReviewMatch:()=>null});
 vm.runInNewContext(html.slice(html.indexOf('function horseRaceEventBadges('),html.indexOf('function horseRaceRefreshEventBadges(')),e);
 e.raceConditionReviewRecords=null;assert.match(e.horseRaceEventBadges({}),/読み込み中/);assert.doesNotMatch(e.horseRaceEventBadges({}),/未登録/);
 e.raceConditionReviewError='offline';assert.match(e.horseRaceEventBadges({}),/取得できません/);
 e.raceConditionReviewRecords=[];assert.match(e.horseRaceEventBadges({}),/未登録・紐づけ未確認/);
});
test('individual verified grade patches refresh only that horse and preserve later local edits',()=>{
 const verified='2026-11-28T08:30:27Z',patch={...latest,_publicSnapshotAt:verified},later={...latest,name:'別馬'},local=[{...latest,races:[{eval:'S'}],_publicSnapshotAt:'2026-11-28T07:50:00Z'},{...later,_localSavedAt:'2026-11-28T07:50:00Z'}];
 const changed=env.publicCacheUpdates([patch,later],local,'name',exportedAt);assert.equal(changed.length,1);assert.equal(changed[0].name,latest.name);assert.equal(changed[0]._publicSnapshotAt,verified);assert.equal(env.publicCacheUpdates([patch],[{...latest,_localSavedAt:'2026-11-28T09:00:00Z'}],'name',exportedAt).length,0);
});
