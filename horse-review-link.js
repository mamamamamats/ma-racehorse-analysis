/* Shared, read-only race identity resolution for horse details and lap scoring. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HorseReviewLink=api;})(globalThis,()=>{
 'use strict';
 const norm=v=>String(v||'').normalize('NFKC').replace(/[\s　・･_()（）]/g,'').toLowerCase();
 function date(v){const m=String(v||'').normalize('NFKC').match(/(20\d{2})[\/年.-](\d{1,2})[\/月.-](\d{1,2})/);if(!m)return '';const y=+m[1],mo=+m[2],d=+m[3],t=new Date(Date.UTC(y,mo-1,d));return t.getUTCFullYear()===y&&t.getUTCMonth()===mo-1&&t.getUTCDate()===d?m[1]+m[2].padStart(2,'0')+m[3].padStart(2,'0'):'';}
 const runDate=r=>date(r.raceRef?.date)||date(r.date)||date(r.raceDate)||date(r.name);
 function course(r){const ref=r.raceRef||{},t=String(r.track||ref.track||'').normalize('NFKC');return {venue:ref.venue||t.match(/札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉/)?.[0]||'',surface:ref.surface||(/芝/.test(t)?'芝':/ダ/.test(t)?'ダート':''),distance:Number(ref.distance||t.match(/(?:芝|ダート|ダ)(\d{3,4})/)?.[1])||0};}
 function title(v){return norm(v).replace(/20\d{2}[\/年.-]\d{1,2}[\/月.-]\d{1,2}日?/g,'').replace(/^(?:[234２３４]歳以上|[234２３４]歳)/,'');}
 const idOf=r=>r.raceId||r._docId||'';
 function index(reviews,{days=[]}={}){const byId=new Map(),byDate=new Map(),runners=new Map(),daysByDate=new Map();for(const day of days){const d=date(day.date);if(!daysByDate.has(d))daysByDate.set(d,[]);daysByDate.get(d).push(day);}for(const r of reviews||[]){for(const id of [r.raceId,r._docId].filter(Boolean))byId.set(String(id),r);const d=date(r.raceRef?.date);if(d){if(!byDate.has(d))byDate.set(d,new Map());byDate.get(d).set(idOf(r),r);}}return {byId,byDate,runners,daysByDate};}
 function contradictions(run,record){const ref=record.raceRef||{},rd=date(ref.date),target=course(record),reasons=[];
  for(const source of [run.raceRef?.date,run.date,run.raceDate,run.name]){const d=date(source);if(d&&rd&&d!==rd&&!reasons.includes('date'))reasons.push('date');}
  for(const raw of [{track:run.track},{raceRef:run.raceRef||{}}]){const c=course(raw);for(const k of ['venue','surface','distance'])if(c[k]&&target[k]&&c[k]!==target[k]&&!reasons.includes(k))reasons.push(k);}
  const rn=Number(run.raceRef?.raceNumber||run.raceRef?.r||run.raceNumber||0),tn=Number(ref.raceNumber||ref.r||0);if(rn&&tn&&rn!==tn)reasons.push('raceNumber');
  return reasons;
 }
 function resolve(run,reviewsOrIndex,{horseName='',days=[]}={}){const idx=Array.isArray(reviewsOrIndex)?index(reviewsOrIndex,{days}):reviewsOrIndex;
  const member=r=>{if(!horseName)return true;const id=String(idOf(r));if(!idx.runners.has(id)){const entries=[];for(const day of idx.daysByDate?.get(date(r.raceRef?.date))||[])for(const v of day.venues||[])for(const race of v.races||[]){const rid=race.raceId||'race_'+(day.id||day._docId)+'_'+encodeURIComponent(v.name)+'_'+Number(race.r);if(String(rid)===id)entries.push(...(race.horses||[]));}idx.runners.set(id,entries.length?new Set(entries.map(h=>norm(h.name)).filter(Boolean)):null);}const names=idx.runners.get(id);return !names||names.has(norm(horseName));};
  if(run?.raceId){const record=idx.byId.get(String(run.raceId));if(!record)return {record:null,status:'missing',candidates:[]};const reasons=contradictions(run,record);if(!member(record))reasons.push('membership');return {record:reasons.length?null:record,status:reasons.length?'conflict':'linked',reasons,candidates:[record]};}
  if(!run)return {record:null,status:'unmatched',candidates:[]};
  const d=runDate(run),c=course(run);if(!d||!c.venue||!c.surface||!c.distance)return {record:null,status:'insufficient',candidates:[]};
  const rn=Number(run.raceRef?.raceNumber||run.raceRef?.r||run.raceNumber||0),name=title(run.name||run.raceRef?.raceName);
  const candidates=[...(idx.byDate.get(d)?.values()||[])].filter(r=>{const x=course(r),ref=r.raceRef||{},num=Number(ref.raceNumber||ref.r||0);return c.venue===x.venue&&c.surface===x.surface&&c.distance===x.distance&&(rn?rn===num:!!name&&name===title(ref.raceName||ref.name));});
  const matches=candidates.filter(r=>!contradictions(run,r).length&&member(r));
  return {record:matches.length===1?matches[0]:null,status:matches.length===1?'inferred':matches.length?'ambiguous':candidates.length?'conflict':'unmatched',candidates:matches.length?matches:candidates};
 }

 return {norm,date,runDate,course,title,idOf,index,contradictions,resolve};
});
