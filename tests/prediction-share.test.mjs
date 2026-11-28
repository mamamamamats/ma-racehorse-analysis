import test from 'node:test';
import assert from 'node:assert/strict';
import Share from '../prediction-share-model.js';
const selection={mainPattern:'back_loaded',referenceRaces:12,mainBasis:{count:8},counts:{front_loaded:2,back_loaded:8,even:2},picks:[{num:1,name:'本命馬',mark:'◎',originalScore:4.15,selectionScore:4.6,reason:'基礎点が高い。東京の適性も高い。'},{num:8,name:'条件で浮上する馬',mark:'☆',originalScore:3.1,reason:'前傾想定なら◎。'}],extraCandidates:[{num:9,name:'印外の紐候補',score:3.02}]};
const context={date:'2026/11/29',venue:'東京',raceNumber:12,raceName:'ジャパンカップ',surface:'芝',distance:2400,going:'良',lapClass:'graded',profile:{count:8,front200:12.2,back200:11.8},createdLabel:'2026/11/28 10:00'};
test('captures displayed original scores, reasons, alternate marks and unmarked extras without mutation',()=>{
 const before=JSON.stringify(selection),card=Share.capture(selection,context);assert.equal(JSON.stringify(selection),before);assert.equal(card.picks[0].score,4.15);assert.equal(card.picks[1].mark,'☆');assert.equal(card.extras[0].name,'印外の紐候補');
 selection.picks[0].reason+='変更';assert.equal(card.picks[0].reason,'基礎点が高い。東京の適性も高い。');selection.picks[0].reason='基礎点が高い。東京の適性も高い。';
 assert.ok(Math.abs(card.front-73.2)<1e-9);assert.ok(Math.abs(card.back-70.8)<1e-9);assert.equal(card.classLabel,'重賞（G1〜G3）');
 const svg=Share.svg(card);assert.match(svg,/4\.15点/);assert.doesNotMatch(svg,/4\.60点/);assert.match(svg,/平均ラップ 8R/);assert.match(svg,/前半 73\.2秒/);assert.match(svg,/印外の紐候補/);assert.ok(svg.indexOf('今回の予想')<svg.indexOf('この条件のラップ判断材料'));assert.ok(svg.indexOf('この条件のラップ判断材料')<svg.indexOf('印外の紐候補'));
});
test('missing evidence remains unknown and does not fabricate average times or a lap prediction',()=>{
 const card=Share.capture({...selection,mainPattern:null,referenceRaces:0,mainBasis:null,counts:{}},{...context,profile:null});const svg=Share.svg(card);assert.match(svg,/判断材料不足/);assert.match(svg,/平均ラップ 0R/);assert.doesNotMatch(svg,/平均：前半/);assert.doesNotMatch(svg,/後傾想定/);
});
test('SVG wraps long content, grows in height and escapes all supplied text',()=>{
 const card=Share.capture({...selection,picks:Array.from({length:8},(_,i)=>({...selection.picks[0],num:i+1,name:'非常に長い馬名と表示の確認',reason:'東京コースで好走。'.repeat(35)+'<&script>"'}))},{...context,raceName:'長いレース名'.repeat(7)+'<&script>'});const svg=Share.svg(card);assert.ok(Number(svg.match(/height="(\d+)"/)[1])>2000);assert.match(svg,/&lt;/);assert.doesNotMatch(svg,/<script>|foreignObject/);assert.ok(Share.wrap('あいうえお'.repeat(20),300,30).every(s=>Array.from(s).length<=10));assert.equal((svg.match(/非常に長い馬名と表示の確認/g)||[]).length,8);
});
test('lap graphics preserve counts and normalize partial 100m segments without changing the prediction',()=>{
 const profile={count:6,front200:12.1,back200:11.9,interpolated:true,laps:[6,12,12,12,12,12,12,12,12],segments:[100,200,200,200,200,200,200,200,200]};
 const original=JSON.stringify(selection),card=Share.capture(selection,{...context,distance:1700,profile});assert.equal(card.lapPoints[0].seconds,12);assert.equal(card.lapPoints[0].distance,100);assert.equal(card.lapPoints.at(-1).distance,1700);profile.laps[0]=90;assert.equal(card.lapPoints[0].seconds,12);assert.equal(JSON.stringify(selection),original);
 const svg=Share.svg(card);assert.match(svg,/data-chart="lap-pattern-distribution"/);assert.match(svg,/data-chart="average-lap"/);assert.match(svg,/後傾 8R \/ 67%/);assert.match(svg,/200m換算/);assert.match(svg,/上ほど速い/);assert.match(svg,/100m/);assert.match(svg,/1700m/);assert.doesNotMatch(svg,/NaN|Infinity/);
 const missing=Share.svg(Share.capture(selection,{...context,profile:{...profile,segments:[200]}}));assert.doesNotMatch(missing,/data-chart="average-lap"/);assert.match(missing,/区間データなし/);
});
