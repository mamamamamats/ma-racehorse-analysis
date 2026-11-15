/* Deterministic, derived comparisons. Raw prediction snapshots remain authoritative. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./weekly-review-model.js'),require('./prediction-review-model.js'),require('./day-going-model.js'),require('./running-style-model.js')):factory(root.WeeklyReviewModel,root.PredictionReviewModel,root.DayGoingModel,root.RunningStyleModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.AnalysisArchiveModel=api;})(typeof globalThis!=='undefined'?globalThis:this,(M,PR,G,RS)=>{
 'use strict';
 const VERSION='favorite-comparison-v2';
 const dateKey=x=>{const p=String(x||'').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);return p?p[1]+'-'+p[2].padStart(2,'0')+'-'+p[3].padStart(2,'0'):'';};
 const identity=p=>p.raceRef?.dayId&&p.raceRef?.venue&&p.raceRef?.raceNumber?[p.raceRef.dayId,p.raceRef.venue,p.raceRef.raceNumber].join('|'):p.raceId||p.raceKey||p._docId;
 const refKey=x=>[x.dayId,x.venue||x.venueName,Number(x.raceNumber||x.r||0)].join('|');
 function rawRow(p,resultDocs,days=[],styleIndex=new Map()){
  const ref=p.raceRef||{},s=p.raceSnapshot||{},dayId=ref.dayId||String(p.raceKey||'').split('__')[0],venueName=ref.venue||s.venue||'',r=Number(ref.raceNumber||s.raceNumber||0);
  const masterDay=days.find(d=>d.id===dayId),date=s.date||ref.date||masterDay?.date||'';
  const master=masterDay?.venues?.find(v=>v.name===venueName)?.races?.find(z=>Number(z.r)===r);
  const resultDoc=(p.raceId?resultDocs.find(d=>(d.raceId||d._docId)===p.raceId):null)||resultDocs.find(d=>refKey(d)===refKey({dayId,venue:venueName,raceNumber:r}));
  const result=resultDoc?.result||(Array.isArray(resultDoc?.horses)?resultDoc:null)||null;
  const entryMap=new Map((p.horses||[]).map(h=>[Number(h.num),{num:h.num,name:h.name}]));for(const h of [...(master?.horses||[]),...(result?.horses||[])])if(!entryMap.has(Number(h.num)))entryMap.set(Number(h.num),{num:h.num,name:h.name||'馬番'+h.num});const entries=[...entryMap.values()];
  const target={raceId:p.raceId||identity(p),day:{id:dayId,date},venue:{name:venueName},race:{r,name:s.raceName||ref.raceName||ref.name||master?.name||'',track:s.track||master?.track||'',grade:s.grade||ref.grade||'',horses:entries},going:master?G.goingFor(master):p.targetGoing||s.trackCondition||'良',prediction:p,result,resultDoc};
  target.outcome=M.outcome(p,result,entries);if(Number(s.horseCount)>entries.length)target.outcome.complete=false;return RS.enrich(target,styleIndex);
 }
 function rows(predictions,resultDocs,days=[],config='standard',styleIndex=new Map()){
  const groups=new Map();for(const p of predictions){const key=identity(p);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
  const out=[];for(const ps of groups.values()){const sample=ps.slice().sort((a,b)=>String(a.createdAt||'9999').localeCompare(String(b.createdAt||'9999')))[0],target=rawRow(sample,resultDocs,days,styleIndex),p=M.selectPrediction(ps,target,config);if(p)out.push(rawRow(p,resultDocs,days,styleIndex));}
  return out.sort((a,b)=>dateKey(b.day.date).localeCompare(dateKey(a.day.date))||a.venue.name.localeCompare(b.venue.name)||a.race.r-b.race.r);
 }
 function filter(rows,{from='',to='',venue='',surface='',distance='',going=''}={}){return rows.filter(row=>{const c=PR.context(row),d=dateKey(row.day.date);return (!from||d>=from)&&(!to||d<=to)&&(!venue||venue===c.venue)&&(!surface||surface===c.surface)&&(!distance||Number(distance)===c.distance)&&(!going||going===c.going);});}
 function groups(rows,group='course',mode='place'){const map=new Map();for(const row of rows){const c=PR.context(row),parts=group==='venue'?[c.venue]:group==='going'?[c.going]:group==='surface'?[c.surface]:[c.venue,c.surface,c.distance+'m',c.going],key=JSON.stringify(parts);if(!map.has(key))map.set(key,{label:parts.join(' · '),rows:[]});map.get(key).rows.push(row);}return [...map.values()].map(g=>({...g,summary:M.summarize(g.rows),misses:PR.misses(g.rows,{mode}),deltas:PR.summary(PR.misses(g.rows,{mode}))})).sort((a,b)=>b.summary.total-a.summary.total||a.label.localeCompare(b.label));}
 function canonical(x){return JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
 function hash(x){const text=canonical(x);let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619)>>>0;return h.toString(16);}
 function derived(row,computedAt){
  const p=row.prediction,clean=h=>({num:h.num,name:h.name||'',rank:h.rank??null,score:h.score??null,baseScore:h.baseScore??null,bonusScore:h.bonusScore??null,factors:h.factors||{},runningStyle:h.runningStyle||null,postRaceEval:h.postRaceEval||null,actualPosition:h.actualPosition||null,finish:h.finish??null,resultStatus:h.resultStatus||''});
  const miss=PR.misses([row])[0],state=!row.outcome.complete?'pending':!row.outcome.top?'unrated':row.outcome.top.postRaceEval==='F'?'excluded-F':['取消','中止'].includes(row.outcome.top.resultStatus)?'excluded':Number(row.outcome.top.finish)<=3?'hit':'miss';
  const input={version:VERSION,raceId:row.raceId,engine:p.engineVersion,context:PR.context(row),state,expectedHorseCount:p.raceSnapshot?.horseCount??null,horses:(p.horses||[]).map(clean),actualByNum:row.actualByNum||{},result:(row.result?.horses||[]).map(h=>({num:h.num,finish:h.finish??null,status:h.status||''})).sort((a,b)=>Number(a.num)-Number(b.num))};
  return {version:VERSION,sourceFingerprint:hash(input),computedAt,raceId:row.raceId,date:row.day.date,context:PR.context(row),state,favorite:row.outcome.top?clean(row.outcome.top):null,good:miss?miss.good.map(clean):[],deltas:miss?PR.summary([miss]):[],comparisons:miss?miss.good.map(h=>({num:h.num,values:PR.compare(miss.favorite,h)})):[]};
 }
 return {VERSION,dateKey,identity,rawRow,rows,filter,groups,derived,hash};
});
