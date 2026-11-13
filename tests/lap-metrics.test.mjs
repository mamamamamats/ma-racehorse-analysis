import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const L=createRequire(import.meta.url)('../lap-metrics.js');
const parsed=(laps,distance=1600)=>({laps,segments:laps.map(()=>200),distance});
test('class groups separate maiden, winners and graded races; individual selection remains exact',()=>{
 assert.equal(L.matchesClass('un','winplus'),false);assert.equal(L.matchesClass('1s','winplus'),true);assert.equal(L.matchesClass('g1','winplus'),true);assert.equal(L.matchesClass('op','graded'),false);assert.equal(L.matchesClass('g2','graded'),true);assert.equal(L.matchesClass('2s','1s'),false);assert.equal(L.resolveClass('auto','G2'),'graded');assert.equal(L.resolveClass('auto','un'),'un');
});
test('profile is the arithmetic mean per interval, not the most common recorded label',()=>{
 const p=L.meanProfile([parsed([10,10,10,10,14,14,14,14]),parsed([12,12,12,12,12,12,12,12])]);assert.deepEqual(p.laps,[11,11,11,11,13,13,13,13]);assert.equal(p.pattern,'front_loaded');assert.equal(p.count,2);
});
test('front/back directions and even deadband are consistent',()=>{
 assert.equal(L.meanProfile([parsed([14,14,14,14,10,10,10,10])]).pattern,'back_loaded');assert.equal(L.meanProfile([parsed(Array(8).fill(12))]).pattern,'even');assert.equal(L.splitPattern([12,12,12.05,12.05],[200,200,200,200]).pattern,'even');assert.equal(L.splitPattern([12,12,12.1,12.1],[200,200,200,200]).pattern,'even');
});
test('100m starts preserve distance and flag interpolation at the midpoint',()=>{
 const p=L.splitPattern([6,12,12,12,12,12,12,12,12,12,12],[100,200,200,200,200,200,200,200,200,200,200]);assert.equal(p.pattern,'even');assert.equal(p.interpolated,true);assert.equal(p.front200,12);assert.equal(p.back200,12);
});
test('different distances never enter the same mean profile',()=>{
 const p=L.meanProfile([parsed(Array(8).fill(12)),parsed(Array(6).fill(10),1200)]);assert.equal(p.count,1);
});
const reviews=[
 {raceId:'a',raceRef:{date:'2026/11/1',surface:'芝',distance:1200,venue:'東京',grade:'un'},events:{lapPattern:['front_loaded','mid_slow']}},
 {raceId:'b',raceRef:{date:'2026/11/2',surface:'芝',distance:2400,venue:'京都',grade:'g2'},events:{lapPattern:['front_loaded']}},
 {raceId:'c',raceRef:{date:'2026/11/3',surface:'ダート'},events:{lapPattern:['front_loaded']}},
 {raceId:'future',raceRef:{date:'2026/11/14',surface:'芝'},events:{lapPattern:['front_loaded']}}
];
test('horse aptitude averages S/A/B/C/D across distances and tracks, with D=0 and F excluded',()=>{
 const horse={races:[{raceId:'a',eval:'S'},{raceId:'b',eval:'D'},{raceId:'c',eval:'S'},{raceId:'future',eval:'S'},{name:'同名でも紐づけない',eval:'S'}]};
 const p=L.horseAptitude(horse,reviews,'front_loaded',{surface:'芝',before:'20261114'});assert.equal(p.avg,3);assert.equal(p.count,2);assert.equal(p.linked,2);assert.equal(p.total,5);
 const f=L.horseAptitude({races:[{raceId:'a',eval:'F'},{raceId:'b',eval:'D'}]},reviews,'front_loaded',{surface:'芝',before:'20261114'});assert.equal(f.avg,0);assert.equal(f.count,1);
});
test('missing links, no target pattern and duplicate history never fabricate scores',()=>{
 assert.equal(L.horseAptitude({races:[{name:'同名',eval:'S'}]},reviews,'front_loaded').avg,null);assert.equal(L.horseAptitude({races:[{raceId:'a',eval:'S'}]},reviews,null).avg,null);assert.equal(L.horseAptitude({races:[{raceId:'a',eval:'S'},{raceId:'a',eval:'S'}]},reviews,'front_loaded').count,1);
});
test('a raw numeric lap classification takes priority over a prose category',()=>{
 const p=L.horseAptitude({races:[{raceId:'a',eval:'A'}]},reviews,'back_loaded',{parse:r=>r.raceId==='a'?parsed([14,14,14,14,10,10,10,10]):null});assert.equal(p.avg,4);
});
