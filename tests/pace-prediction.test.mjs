import test from 'node:test';import assert from 'node:assert/strict';import M from '../pace-prediction-model.js';
function fixture(){const ranked=Array.from({length:7},(_,i)=>({num:i+1,name:'馬'+(i+1),score:4.8-i*.1,rank:i+1,bonusScore:0,factors:{overall:4.8-i*.1,lap:4.8-i*.1}}));const evidence=ranked.flatMap(h=>['front_loaded','even','back_loaded'].flatMap(p=>[1,2].map(i=>({num:h.num,raceId:p+h.num+'-'+i,pattern:p,value:p==='back_loaded'?(h.num===6?6:0):3}))));return {result:{ranked,basis:{profile:{pattern:'front_loaded',count:6}},weights:{overall:3,lap:3}},evidence,cohort:Array.from({length:6},(_,i)=>({raceId:'c'+i,pattern:'front_loaded'}))};}
test('keeps score ranking immutable and adds outside-main horse as ☆ only when sole alternative leader',()=>{const x=fixture(),before=JSON.stringify(x),s=M.select(x);assert.equal(s.mainPattern,'front_loaded');assert.deepEqual(s.picks.slice(0,5).map(h=>h.num),[1,2,3,4,5]);const star=s.picks.find(h=>h.mark==='☆');assert.equal(star.num,6);assert.match(star.reason,/後傾想定なら◎/);assert.equal(star.conditions[0].count,2);assert.equal(JSON.stringify(x),before);});
test('missing rival evidence, zero lap weight, ties and F-excluded missing runs do not claim a scenario ◎',()=>{for(const change of [x=>{x.evidence=x.evidence.filter(e=>!(e.num===7&&e.pattern==='back_loaded'));},x=>{x.result.weights.lap=0;},x=>{for(const e of x.evidence)if(e.num===7&&e.pattern==='back_loaded')e.value=6.1;},x=>{x.evidence=x.evidence.filter(e=>!(e.num===6&&e.pattern==='back_loaded'&&e.raceId.endsWith('-2')));}]){const x=fixture();change(x);assert.equal(M.select(x).picks.some(h=>h.mark==='☆'),false);}});
test('insufficient classified or parsed lap samples never assert a main; average profile determines main, not majority counts',()=>{
 for(const cohort of [[{raceId:'a',pattern:'front_loaded'}],Array.from({length:8},()=>({raceId:'same',pattern:'front_loaded'}))])assert.equal(M.select({...fixture(),cohort}).mainPattern,null);
 const x=fixture();x.result.basis.profile.count=4;assert.equal(M.select(x).mainPattern,null);
 x.result.basis.profile.count=6;x.result.basis.profile.pattern='even';assert.equal(M.select(x).mainPattern,'even');
});
test('same horse history is deduplicated and invalid or missing values are never zero-filled',()=>{const x=fixture();x.evidence=x.evidence.filter(e=>!(e.num===6&&e.pattern==='back_loaded'&&e.raceId.endsWith('-2')));x.evidence.push(x.evidence.find(e=>e.num===6&&e.pattern==='back_loaded'));assert.equal(M.select(x).picks.some(h=>h.mark==='☆'),false);});
test('main lap reorders only horses with comparable past evidence, retaining unsupported positions',()=>{const x=fixture();for(const e of x.evidence)if(e.pattern==='front_loaded')e.value=e.num===5?6:0;x.evidence=x.evidence.filter(e=>!(e.num===1&&e.pattern==='front_loaded'));const s=M.select(x);assert.equal(s.picks[0].num,1);assert.equal(s.picks[1].num,5);assert.equal(s.picks[1].mark,'○');});
test('pace labels cannot be substituted for lap patterns; missing lap evidence never receives a star',()=>{
 const x=fixture();x.evidence=x.evidence.map(({pattern,...r})=>({...r,pace:'high'}));const s=M.select(x);assert.equal(s.picks.some(h=>h.mark==='☆'),false);assert.deepEqual(s.picks.map(h=>h.num),[1,2,3,4,5]);
 x.cohort=x.cohort.map(({pattern,...r})=>({...r,pace:'middle'}));assert.equal(M.select(x).mainPattern,null);
});
test('a real tied alternative winner does not receive a sole-◎ claim',()=>{
 const x=fixture();x.result.weights.overall=0;for(const e of x.evidence)if(e.pattern==='back_loaded'&&e.num===7)e.value=6;
 assert.equal(M.select(x).picks.some(h=>h.mark==='☆'),false);
});
test('prediction reasons name base points, specific aptitude conditions and counted evidence without inventing strengths',()=>{
 const result={context:{venue:'東京',surface:'芝',distance:1600,going:'稍重'},weights:{venue:3,distance:3,condition:3,lap:3}};
 const horse={baseScore:4.1,bonusScore:1.2,factors:{venue:4.5,distance:4.2,condition:3.8,lap:null},venueStats:{count:5},distanceStats:{count:4},conditionStats:{count:3},highConditionKeys:['venue','condition']};
 const text=M.explain(horse,result);for(const word of ['基礎点4.10','高評価','東京・芝の競馬場適性4.50（5走）','1600mの距離適性4.20','稍重の馬場適性3.80','条件ボーナスの対象：競馬場・馬場'])assert.ok(text.includes(word),word);
 result.weights.distance=0;assert.ok(!M.explain(horse,result).includes('距離適性'));
 assert.match(M.explain({baseScore:2.5,bonusScore:0,factors:{}},result),/標準3.0未満/);
});
