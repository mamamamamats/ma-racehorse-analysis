/* Display-only ordering. Original run indices and scoring arrays remain untouched. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReviewChronology=api;})(globalThis,()=>{
 const date=x=>{const m=String(x||'').match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);if(!m)return '';const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]),v=new Date(Date.UTC(y,mo-1,d));return v.getUTCFullYear()===y&&v.getUTCMonth()===mo-1&&v.getUTCDate()===d?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';};
 function order(runs,{reviews=[],days=[]}={}){const byId=new Map();for(const day of days)for(const venue of day.venues||[])for(const race of venue.races||[]){const id=race.raceId||`race_${day.id}_${encodeURIComponent(venue.name)}_${Number(race.r||0)}`;byId.set(id,date(day.date));}for(const r of reviews){const d=date(r.raceRef?.date);if(d)for(const id of [r.raceId,r._docId].filter(Boolean))byId.set(id,d);}return (runs||[]).map((run,index)=>({index,date:date(run.raceRef?.date)||byId.get(run.raceId)||''})).sort((a,b)=>Number(!!b.date)-Number(!!a.date)||b.date.localeCompare(a.date)||a.index-b.index);}
 return {date,order};
});
