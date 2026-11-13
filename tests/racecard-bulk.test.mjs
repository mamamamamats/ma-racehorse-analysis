import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('let racecardBulkValidated=null;');
const end=html.indexOf('async function saveEditRace()',start);
assert.ok(start>=0&&end>start);
const core=html.slice(start,end);
const setup=String.raw`let raceDays=deps.days;const isEditMode=true;const document={getElementById:id=>deps.els[id],querySelector:()=>deps.preview};const window={_fbDb:{},_fbFns:deps.firebase};const idbPut=deps.idbPut,waitForFirebase=async()=>true;const ensureRaceId=(day,venue,race)=>race.raceId||(race.raceId=day.id+'|'+venue.name+'|'+race.r);const dowFromYMD=()=> '土';const invalidateHorseCache=()=>{},updateHomeStats=()=>{},renderEditView=()=>{},bumpSyncVersion=()=>{deps.bumps++;};`;
const make=new Function('deps',setup+core+'return {preview:previewRacecardBulkJson,save:saveRacecardBulkJson,invalidate:invalidateRacecardBulkPreview,parse:parseRacecardBulkJson,getDays:()=>raceDays,isSaving:()=>racecardBulkSaving};');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(options={}){
  let remote=options.remote?clone(options.remote):null;
  const deps={days:options.days||[],bumps:0,preview:{disabled:false},els:Object.fromEntries(['racecardBulkPreview','racecardBulkSave','racecardBulkJson'].map(k=>[k,{style:{},disabled:false,textContent:'',value:'',readOnly:false}])),writes:0,calls:0,saved:[]};
  deps.els.racecardBulkJson.value=JSON.stringify({date:'2026-11-14',venues:[{venue:'東京',races:[{raceNumber:1,raceName:'テスト新規',raceClass:'未勝利',course:'芝1600',horses:[{frame:1,number:1,horseName:'テスト馬'}]}]}]});
  deps.firebase={doc:(_d,col,id)=>({col,id}),runTransaction:async(_d,cb)=>{deps.calls++;await Promise.resolve();if(options.remoteFailure)throw Error('permission-denied');let next=null;const result=await cb({get:async()=>({exists:()=>!!remote,data:()=>clone(remote)}),set:(_r,v)=>{next=clone(v);}});if(next){remote=next;deps.writes++;}return result;}};
  deps.idbPut=async(store,value)=>{if(options.localFailure&&store==='raceDays')throw Error('QuotaExceededError');deps.saved.push({store,value:clone(value)});};
  return {deps,app:make(deps),getRemote:()=>remote};
}
test('double click and repeated import create one day and race',async()=>{
  const f=fixture();f.app.preview();assert.equal(f.deps.els.racecardBulkSave.disabled,false);
  await Promise.all([f.app.save(),f.app.save()]);
  assert.equal(f.deps.calls,1);assert.equal(f.app.getDays().length,1);assert.equal(f.getRemote().venues[0].races.length,1);
  f.app.preview();await f.app.save();assert.equal(f.deps.writes,1);
});
test('duplicate display is reconciled while existing records and backup are retained',async()=>{
  const remote={id:'day-2026-11-14',date:'2026/11/14',venues:[{name:'東京',races:[{r:1,name:'既存レース',review:'維持',horses:[{name:'既存馬'}]}]}]};
  const f=fixture({remote,days:[clone(remote),clone(remote)]});f.app.preview();await f.app.save();
  assert.equal(f.app.getDays().length,1);assert.equal(f.getRemote().venues[0].races[0].review,'維持');assert.equal(f.deps.writes,0);
  assert.ok(f.deps.saved.some(v=>v.store==='memos'&&v.value.value.length===2));
});
test('races added remotely since preview are preserved',async()=>{
  const f=fixture({remote:{id:'day-2026-11-14',date:'2026/11/14',venues:[{name:'京都',races:[{r:2,name:'別端末で追加',result:{finish:1}}]}]}});
  f.app.preview();await f.app.save();assert.equal(f.getRemote().venues.length,2);assert.equal(f.getRemote().venues[0].races[0].result.finish,1);
});
test('remote failure retains input and permits retry without changing display',async()=>{
  const f=fixture({remoteFailure:true});f.app.preview();const raw=f.deps.els.racecardBulkJson.value;await f.app.save();
  assert.equal(f.app.isSaving(),false);assert.equal(f.deps.els.racecardBulkSave.disabled,false);assert.equal(f.app.getDays().length,0);assert.equal(f.deps.writes,0);assert.equal(f.deps.els.racecardBulkJson.value,raw);
});
test('cache failure after remote success is reported separately',async()=>{
  const f=fixture({localFailure:true});f.app.preview();await f.app.save();
  assert.equal(f.deps.writes,1);assert.equal(f.app.getDays().length,0);assert.match(f.deps.els.racecardBulkPreview.textContent,/Firestoreへの保存は完了/);assert.equal(f.deps.els.racecardBulkSave.disabled,true);
});
test('edited JSON requires a new preview and impossible dates are rejected',()=>{
  const f=fixture();f.app.preview();f.app.invalidate();assert.equal(f.deps.els.racecardBulkSave.disabled,true);
  f.deps.els.racecardBulkJson.value=JSON.stringify({date:'2026-02-30',venues:[]});assert.throws(()=>f.app.parse());
});
test('lap candidates preserve 100m segments and reject distance or total-time mismatches',()=>{
  const js=readFileSync(new URL('../public-assistant.js',import.meta.url),'utf8');
  const parse=js.slice(js.indexOf('  function parseLap(r){'),js.indexOf('  const lapCache='));
  const parseLap=new Function('ref',parse+'return parseLap;')(r=>r.raceRef||{});
  const good={raceRef:{distance:2400},review:'2分24秒8。ラップは12.7-11.7-12.2-12.4-12.4-12.7-12.4-11.9-11.9-11.8-11.2-11.5秒。'};
  assert.equal(parseLap(good).laps.length,12);
  assert.equal(parseLap({raceRef:{distance:2100},review:'ラップは7.1-11.3-12.4-12.7-12.5-12.7-12.8-12.9-12.6-11.9-12.9秒。'}).segments[0],100);
  assert.equal(parseLap({raceRef:{distance:1600},review:'ラップは12.0-12.0-12.0秒。'}),null);
  assert.equal(parseLap({...good,review:good.review.replace('2分24秒8','2分00秒0')}),null);
});
