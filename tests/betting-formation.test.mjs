import test from 'node:test';import assert from 'node:assert/strict';import B from '../betting-results-model.js';import M from '../weekly-review-model.js';import P from '../weekly-publication-model.js';import V from '../weekly-report-visuals.js';
const prediction=(marks=['◎','○','▲','△','☆'],version='lap-selection-v1')=>({...(version?{selectionVersion:version}:{}),horses:marks.map((mark,i)=>({num:i+1,name:'H'+(i+1),rank:i+1,mark,selected:!!mark}))});
function row(p=prediction(),canceled=[]){const entries=p.horses.map(h=>({num:h.num,name:h.name})),result={schemaVersion:1,horses:entries.map(h=>({num:h.num,finish:canceled.includes(h.num)?null:([2,3,1].indexOf(h.num)+1||h.num),...(canceled.includes(h.num)?{status:'取消'}:{})})),payouts:{types:{trifecta:{confirmed:true,payouts:[{numbers:[2,3,1],yen:6000}]},trio:{confirmed:true,payouts:[{numbers:[1,2,3],yen:1200}]}}}};return {raceId:'race',race:{horses:entries},prediction:p,result,outcome:M.outcome(p,result,entries)};}
test('default independent mark groups generate the requested five-horse tickets and all trifecta comparisons',()=>{
 const p=prediction(),before=JSON.stringify(p);assert.deepEqual(Object.keys(B.TYPES).map(t=>B.formationTickets(p,t).length),[1,1,3,3,3,5,36]);
 for(const t of ['wide','quinella','exacta']){const bets=B.formationTickets(p,t);assert.ok(bets.every(b=>b.includes(1)&&!b.includes(4)));}
 const triples=B.formationTickets(p,'trio');assert.ok(triples.every(b=>b.includes(1)&&(b.includes(2)||b.includes(3))));assert.ok(!triples.some(b=>b.join('-')==='1-4-5'));
 assert.equal(B.formationTickets(p,'trifecta','dual-circle').length,18);assert.equal(B.formationTickets(p,'trifecta','dual-triangle').length,18);assert.equal(B.formationTickets(p,'trifecta','dual-union').length,30);assert.equal(JSON.stringify(p),before);
});
test('dual pattern union pays and invests once per unique ticket, including a third-place ◎',()=>{
 const stats=B.simulate([row()],undefined,100,'formation');assert.equal(stats.length,11);const one=stats.find(r=>r.id==='trifecta'),a=stats.find(r=>r.id==='trifecta_circle'),b=stats.find(r=>r.id==='trifecta_triangle'),union=stats.find(r=>r.id==='trifecta_dual_union');
 assert.equal(stats.find(r=>r.id==='trifecta_fixed').tickets,6);assert.equal(stats.find(r=>r.id==='trifecta_fixed').payout,0);assert.equal(one.tickets,36);assert.equal(one.payout,6000);assert.equal(a.payout,6000);assert.equal(b.payout,6000);assert.equal(union.tickets,30);assert.equal(union.payout,6000);assert.equal(union.net,3000);assert.equal(union.roi,200);
});
test('multiple △ and conditional stars expand actual fields, while old automatic rank-five stars stay out',()=>{
 const p=prediction(['◎','○','▲','△','△','☆','☆']);assert.equal(B.formationTickets(p,'wide').length,4);assert.equal(B.formationTickets(p,'trio').length,9);assert.equal(B.formationTickets(p,'trifecta').length,90);assert.equal(B.formationTickets(p,'trifecta','dual-union').length,54);
 const old=prediction(undefined,null);assert.equal(B.markGroups(old)['☆'].length,0);assert.equal(B.formationTickets(old,'wide').length,2);assert.equal(B.formationTickets(old,'trio').length,3);assert.equal(B.simulate([row(old)],undefined,100,'box').length,7);
});
test('missing axes never promote another horse; canceled axis refunds tickets, missing payouts are not losses',()=>{
 const noCircle=prediction(['◎','','▲','△','☆']);assert.equal(B.formationTickets(noCircle,'trifecta','dual-circle').length,0);assert.equal(B.formationTickets(noCircle,'trifecta','dual-triangle').length,12);assert.equal(B.formationTickets(noCircle,'trifecta','dual-union').length,12);
 const noMain=prediction(['','○','▲','△','☆']);assert.equal(B.formationTickets(noMain,'trio').length,0);assert.equal(B.formationTickets(noMain,'trifecta').length,0);
 const r=row(prediction(),[1]),stats=B.simulate([r],undefined,100,'formation');for(const s of stats.filter(s=>s.type==='trifecta')){assert.equal(s.refund,s.gross);assert.equal(s.payout,0);assert.equal(s.roi,null);}assert.equal(stats.find(s=>s.type==='wide').missing,1);
});
test('single marks, separate opponents and restricted one-axis style are configurable',()=>{
 const p=prediction();assert.deepEqual(B.formationTickets(p,'win','',{singleMarks:['○']}),[[2]]);assert.deepEqual(B.formationTickets(p,'wide','',{pairMarks:['△']}),[[1,4]]);assert.equal(B.formationTickets(p,'trifecta','',{singleAxisStyle:'formation'}).length,30);
 assert.equal(B.formationTickets(p,'trio','',{secondMarks:[]}).length,0);assert.throws(()=>B.formationSettings({singleMarks:['bad']}));
});
test('eleven-row published formations render a taller share image and remain compatible with seven-row cards',()=>{
 const boxes=B.simulate([row()],undefined,100,'formation'),card={betMode:'formation',betLabel:B.MODES.formation,betDescription:B.formationDescription(),summary:M.summarize([]),marks:M.markStats([]),boxes,dateLabel:'test',configLabel:'standard',ranksLabel:'◎→○▲☆',stake:100};
 assert.equal(P.validate({schemaVersion:1,card}),true);assert.equal(V.reportHeight(11),1538);const svg=V.svgReport(card);assert.match(svg,/height="1538"/);assert.match(svg,/3連単 2軸合算/);assert.equal(P.validate({schemaVersion:1,card:{...card,boxes:boxes.slice(0,7)}}),false);
 assert.equal(P.validate({schemaVersion:1,card:{...card,betMode:'box',boxes:B.simulate([])}}),true);
});
