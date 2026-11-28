import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import Scale from '../score-display-scale.js';import SI from '../score-interpretation.js';import Share from '../prediction-share-model.js';
test('three and seven points use the same axis across independent race cards',()=>{
 assert.equal(Scale.maximum(),10);assert.deepEqual(Scale.ticks(10),[0,2.5,5,7.5,10]);assert.deepEqual(Scale.parts(2,1),{base:20,bonus:10});assert.deepEqual(Scale.parts(6,1),{base:60,bonus:10});assert.equal(Scale.parts(null,1),null);
 const source=fs.readFileSync(new URL('../public-assistant.js',import.meta.url),'utf8'),env={window:{ScoreDisplayScale:Scale},SI,publicAppliedWeights:{},state:{scoreOrder:'total'},E:String,num:(n,d)=>Number.isFinite(n)?n.toFixed(d):'—',mint:'#7de8c5',violet:'#bca8f5',btn:()=>'',empty:String,note:String};
 vm.runInNewContext(source.slice(source.indexOf('function componentScores('),source.indexOf('  PA.researchFromRace=')),env);
 for(const [base,total]of [[2,3],[6,7]]){const h={num:1,name:'対象馬',baseScore:base,bonusScore:1,customScore:total,factors:{overall:base}};const component=env.componentScores(h),comparison=env.scoreComparison([h]);assert.ok(component.includes(`width:${base/10*100}%`));assert.ok(comparison.includes(`width:${base/10*100}%`));assert.ok(comparison.includes('data-score-max="10"'));assert.ok(comparison.includes('0〜10点'));}
});
test('exported score bars carry exact base/bonus snapshots and share the fixed axis',()=>{
 const widths=[];for(const [base,total]of [[2,3],[6,7]]){const sel={picks:[{num:1,name:'対象馬',mark:'◎',originalScore:total,reason:'根拠'}],counts:{}},context={raceName:'レース',scoreRows:[{num:1,baseScore:base,bonusScore:1}]};const before=JSON.stringify(context),card=Share.capture(sel,context);const svg=Share.svg(card);assert.equal(card.picks[0].baseScore,base);assert.equal(card.picks[0].bonusScore,1);assert.equal(JSON.stringify(context),before);assert.match(svg,/data-score-max="10"/);widths.push([...svg.matchAll(/data-score-part="(?:base|bonus)"[^>]*width="([\d.]+)"/g)].reduce((sum,m)=>sum+Number(m[1]),0));}
 assert.ok(Math.abs(widths[1]/widths[0]-7/3)<1e-9);
});

test('weight-based tiers and overflow are independent of race scores',()=>{
 assert.equal(Scale.maximum({venue:3,distance:3,condition:3}),10);
 assert.equal(Scale.maximum({venue:4,distance:4,condition:4}),15);
 assert.equal(Scale.maximum({venue:6,distance:6,condition:6}),20);
 assert.deepEqual(Scale.parts(6,6.3,10),{base:60,bonus:40});
 for(const weight of [3,4,6]){const weights={venue:weight,distance:weight,condition:weight};const card=Share.capture({picks:[{num:1,originalScore:12.3,baseScore:6,bonusScore:6.3}]},{weights});assert.equal(card.scoreMax,Scale.maximum(weights));assert.match(Share.svg(card),new RegExp('data-score-max="'+card.scoreMax+'"'));weights.venue=0;assert.equal(card.scoreMax,Scale.maximum({venue:weight,distance:weight,condition:weight}));}
});
