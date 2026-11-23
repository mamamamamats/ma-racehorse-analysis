import test from 'node:test';
import assert from 'node:assert/strict';
import D from '../prediction-diagnosis-model.js';
const make=()=>({favorite:{num:1,name:'本命',finish:8,score:6,baseScore:4,bonusScore:2,factors:{overall:4},runningStyle:{label:'先行'}},good:[{num:2,name:'勝馬',finish:1,rank:3,score:3,factors:{overall:5},runningStyle:{label:'後方'}}],prediction:{targetGoing:'良',horses:[{num:1,score:6,baseScore:4},{num:2,score:5,baseScore:5}],weightResearch:{entries:[{num:1,counts:{form:1}}]}},going:'重',result:{horses:[{num:2,finish:1}]}});
test('flags expose evidence, next checks, sparse sample and bonus rank reversal without changing input',()=>{
 const row=make(),before=JSON.stringify(row),d=D.diagnose(row);
 for(const key of ['selection','confidence','bonus','condition','factors','style'])assert.ok(d.flags.some(f=>f.key===key),key);
 assert.ok(d.flags.every(f=>f.evidence&&f.next));assert.equal(JSON.stringify(row),before);
 assert.match(d.flags.find(f=>f.key==='confidence').evidence,/全実績数ではありません/);
});
test('zero is scored, null is unknown, absent rank is outside candidates',()=>{
 const row=make();row.good=[{num:2,finish:1,rank:null,score:0},{num:3,finish:2,score:null}];
 const d=D.diagnose(row);assert.equal(d.podiumKnown,1);assert.equal(d.flags.filter(f=>f.key==='missing').length,1);assert.match(d.flags.find(f=>f.title.includes('上位5')).evidence,/順位なし/);
});
test('legacy counts are unknown rather than zero and missing factor is not imputed',()=>{
 const row=make();delete row.prediction.weightResearch;row.favorite.factors={};const d=D.diagnose(row);
 assert.ok(d.flags.some(f=>f.title==='保存時の件数情報がない'));assert.ok(!d.flags.some(f=>f.key==='confidence'||f.key==='factors'));
});
test('counts each category once per race and filters manual review fields',()=>{
 const row=make();row.good.push({score:1,rank:8,finish:2});const counts=D.aggregate([row,row]);
 assert.equal(counts.selection,2);assert.equal(counts.other,0);
 const r=D.review({status:'bad',categories:['bonus','bonus','bad'],hypothesis:'x'.repeat(4000)},'now');
 assert.equal(r.status,'unreviewed');assert.deepEqual(r.categories,['bonus']);assert.equal(r.hypothesis.length,3000);assert.equal(r.updatedAt,'now');
});
test('no reversal and matching going do not raise bonus/condition flags',()=>{
 const row=make();row.going='良';row.prediction.horses[0].baseScore=6;
 assert.ok(!D.diagnose(row).flags.some(f=>['bonus','condition'].includes(f.key)));
});
