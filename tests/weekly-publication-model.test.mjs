import test from 'node:test';import assert from 'node:assert/strict';import P from '../weekly-publication-model.js';import M from '../weekly-review-model.js';import B from '../betting-results-model.js';
test('week boundaries and publication expiry follow Japan calendar dates',()=>{assert.deepEqual(P.week('2026/11/14'),{start:'2026-11-14',end:'2026-11-15'});assert.equal(P.expiry('2026-11-15'),'2026-11-22T15:00:00.000Z');assert.equal(P.japanDay('2026-11-15T16:00:00Z'),'2026-11-16');});
test('public card expires at next Monday 00:00 JST and does not extend on reread',()=>{const record={schemaVersion:1,publishedAt:'2026-11-15T08:00:00Z',expiresAt:P.expiry('2026-11-15')};assert.equal(P.visible(record,Date.parse('2026-11-22T14:59:59Z')),true);assert.equal(P.visible(record,Date.parse('2026-11-22T15:00:00Z')),false);assert.equal(P.visible(record,Date.parse('2026-11-14T00:00:00Z')),false);assert.equal(P.visible(null),false);});
test('malformed public data is rejected before chart rendering',()=>{const card={summary:M.summarize([]),marks:M.markStats([]),boxes:B.simulate([]),dateLabel:'week',configLabel:'standard',ranksLabel:'◎○▲△☆',stake:100},r={schemaVersion:1,card};assert.equal(P.validate(r),true);assert.equal(P.validate({schemaVersion:1,card:{}}),false);card.boxes[0].roi='bad';assert.equal(P.validate(r),false);});

test('Saturday/Sunday and optional following Monday form one meeting, never the preceding Monday',()=>{
 const dates=['2026/11/21','2026/11/22','2026/11/23','2026/11/28','2026/11/29'];
 assert.deepEqual(P.week('2026/11/23',dates),{start:'2026-11-21',end:'2026-11-23'});assert.deepEqual(P.week('2026/11/28',dates),{start:'2026-11-28',end:'2026-11-29'});
 assert.deepEqual(P.week('2026/11/29',[...dates,'2026/11/30']),{start:'2026-11-28',end:'2026-11-30'});assert.equal(P.expiry('2026-11-23'),'2026-11-29T15:00:00.000Z');
 assert.deepEqual(P.scheduleDates('2026-11-23T03:00:00Z',dates),['2026-11-21','2026-11-22','2026-11-23']);assert.deepEqual(P.scheduleDates('2026-11-30T03:00:00Z',dates),['2026-12-05','2026-12-06']);assert.deepEqual(P.scheduleDates('2026-11-30T03:00:00Z',[...dates,'2026/11/30']),['2026-11-28','2026-11-29','2026-11-30']);
 assert.deepEqual(P.week('2026/1/4',['2026/1/5']),{start:'2026-01-03',end:'2026-01-05'});
});
