import test from 'node:test';import assert from 'node:assert/strict';import L from '../horse-review-link.js';import Lap from '../lap-metrics.js';
const review=(id,date='2026/11/1')=>({raceId:id,raceRef:{date,venue:'東京',surface:'芝',distance:1600,raceNumber:7,raceName:'3歳以上1勝クラス',track:'芝1600良'},events:{lapPattern:['front_loaded']}});
const run={name:'1勝クラス',date:'2026/11/1',track:'東京芝1600',eval:'A'};
test('matches unique date/course/class ignoring optional going suffix and retains immutable input',()=>{const r={...run},before=JSON.stringify(r),match=L.resolve(r,[review('a'),review('b','2025/11/1')]);assert.equal(match.status,'inferred');assert.equal(match.record.raceId,'a');assert.equal(JSON.stringify(r),before);});
test('undated or ambiguous common races are never guessed',()=>{assert.equal(L.resolve({...run,date:''},[review('a')]).status,'insufficient');assert.equal(L.resolve(run,[review('a'),review('b')]).status,'ambiguous');assert.equal(L.resolve({...run,track:'東京ダ1600'},[review('a')]).record,null);});
test('explicit ID is respected only without contradictory metadata; dangling IDs never fall back',()=>{assert.equal(L.resolve({...run,raceId:'b'},[review('a'),review('b','2025/1/1')]).status,'conflict');assert.equal(L.resolve({...run,raceId:'a'},[review('a')]).record.raceId,'a');assert.equal(L.resolve({...run,raceId:'missing'},[review('a')]).status,'missing');});
test('dates in run title or raceRef work; bad dates rejected; R number disambiguates titles',()=>{const r={name:'1勝クラス2026/11/1',track:'東京芝1600',eval:'S'};assert.equal(L.resolve(r,[review('a')]).status,'inferred');assert.equal(L.date('2026/2/30'),'');assert.equal(L.resolve({...run,name:'別名',raceRef:{date:'2026/11/1',raceNumber:7}},[review('a')]).status,'inferred');});
test('inferred link contributes identically to explicit link, respects F and excludes same/future day',()=>{const opts={surface:'芝',before:'2026-11-02'};assert.equal(Lap.horseAptitude({races:[run]},[review('a')],'front_loaded',opts).avg,4);assert.equal(Lap.horseAptitude({races:[{...run,raceId:'a'}]},[review('a')],'front_loaded',opts).avg,4);assert.equal(Lap.horseAptitude({races:[{...run,eval:'F'}]},[review('a')],'front_loaded',opts).avg,null);assert.equal(Lap.horseAptitude({races:[run]},[review('a')],'front_loaded',{before:'2026/11/1'}).avg,null);});
test('duplicate IDs count once and missing class/date does not fabricate score',()=>{assert.equal(Lap.horseAptitude({races:[run,{...run,raceId:'a'}]},[review('a')],'front_loaded').count,1);assert.equal(Lap.horseAptitude({races:[{...run,date:''}]},[review('a')],'front_loaded').count,0);});

const dayWith=(races)=>[{id:'d',date:'2026/11/1',venues:[{name:'東京',races}]}];
test('same class and course on same day remain ambiguous; roster membership resolves only the correct race',()=>{
 const a=review('a'),b={...review('b'),raceRef:{...review('b').raceRef,raceNumber:8}};
 const days=dayWith([{raceId:'a',r:7,horses:[{name:'馬A'}]},{raceId:'b',r:8,horses:[{name:'馬B'}]}]);
 assert.equal(L.resolve(run,[a,b]).status,'ambiguous');
 assert.equal(L.resolve(run,[a,b],{horseName:'馬B',days}).record.raceId,'b');
 assert.equal(L.resolve(run,[a,b],{horseName:'非出走馬',days}).status,'conflict');
 const both=dayWith([{raceId:'a',r:7,horses:[{name:'馬A'}]},{raceId:'b',r:8,horses:[{name:'馬A'}]}]);
 assert.equal(L.resolve(run,[a,b],{horseName:'馬A',days:both}).status,'ambiguous');
});
test('repeat participation in same class maps by exact date, never array order or most recent race',()=>{
 const runs=[{...run,date:'2026/11/1'},{...run,date:'2026/11/8'}],reviews=[review('later','2026/11/8'),review('first')];
 assert.deepEqual(runs.map(r=>L.resolve(r,reviews).record.raceId),['first','later']);
 assert.equal(L.resolve({...run,date:''},reviews).record,null);
});
test('contradictory raw fields cannot be hidden by an already copied raceRef',()=>{
 const target=review('a');
 for(const r of [{...run,raceId:'a',name:'1勝クラス2025/11/1',raceRef:target.raceRef},{...run,raceId:'a',track:'阪神芝1600',raceRef:target.raceRef},{...run,raceId:'a',raceNumber:8}])
  assert.equal(L.resolve(r,[target]).status,'conflict');
});
test('roster conflicts exclude even saved IDs from lap scoring; no roster is not claimed as verified',()=>{
 const reviews=[review('a')],days=dayWith([{raceId:'a',r:7,horses:[{name:'別馬'}]}]);
 assert.equal(Lap.horseAptitude({name:'馬A',races:[{...run,raceId:'a'}]},reviews,'front_loaded',{days}).count,0);
 assert.equal(L.resolve(run,reviews,{horseName:'馬A',days:[]}).status,'inferred');
});
