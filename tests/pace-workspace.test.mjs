import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import P from '../pace-model.js';
function load(){const e={PaceModel:P,escHtml:String};e.window=e;vm.runInNewContext(readFileSync(new URL('../pace-workspace.js',import.meta.url),'utf8'),e);return e.PaceUI;}
test('unparseable records without a previous valid auto judgement are not written on every baseline update',()=>{
 const ui=load(),result={pace:null,reason:'条件不明・ラップ不足',baselineVersion:'new'};
 assert.equal(ui.currentPatch({review:'no laps'},result,'now'),null);
 assert.equal(ui.currentPatch({events:{pace:'slow'},paceAnalysis:{latest:{pace:null}}},result,'now'),null);
});
test('invalidated previously usable auto judgements are cleared instead of silently retaining stale pace',()=>{
 const ui=load(),r={events:{pace:'high'},paceMeta:{source:'auto',pace:'high'},paceAnalysis:{latest:{pace:'high',frontTime:48}}};
 assert.equal(ui.currentPatch(r,{pace:null,reason:'条件不明・ラップ不足'},'now').events.pace,null);
});
