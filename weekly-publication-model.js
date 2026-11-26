/* Date-only calculations use Japan calendar days, independent of host timezone. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WeeklyPublicationModel=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const day=x=>{const m=String(x||'').match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';};
 const add=(date,n)=>{const d=new Date(day(date)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 function week(date){const key=day(date);if(!key)throw Error('開催日が不正です');const d=new Date(key+'T00:00:00Z'),dow=d.getUTCDay(),start=add(key,-((dow+6)%7));return {start,end:add(start,6)};}
 const japanDay=now=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 function expiry(weekEnd){return new Date(add(weekEnd,8)+'T00:00:00+09:00').toISOString();}
 function visible(record,now=Date.now()){return !!record&&record.schemaVersion===1&&Number.isFinite(Date.parse(record.expiresAt))&&Date.parse(record.publishedAt)<=Number(now)&&Number(now)<Date.parse(record.expiresAt);}
 function validate(record){
  if(!record||record.schemaVersion!==1||!record.card)return false;const c=record.card,n=(x)=>typeof x==='number'&&Number.isFinite(x)&&x>=0;if(!c.summary||!['saved','total','wins','places','pending','excluded'].every(k=>n(c.summary[k])))return false;
  if(!Array.isArray(c.marks)||c.marks.length!==5||!c.marks.every((m,i)=>m.mark===['◎','○','▲','△','☆'][i]&&['count','wins','places','excluded'].every(k=>n(m[k]))&&(m.average===null||n(m.average))))return false;
  if(!Array.isArray(c.boxes)||c.boxes.length!==7||!c.boxes.every(b=>typeof b.label==='string'&&['races','missing','insufficient','net','payout'].every(k=>n(b[k]))&&(b.roi===null||n(b.roi))))return false;
  if(c.betMode!=null&&!['box','axis'].includes(c.betMode))return false;if(c.betLabel!=null&&typeof c.betLabel!=='string')return false;
  return typeof c.dateLabel==='string'&&typeof c.configLabel==='string'&&typeof c.ranksLabel==='string'&&n(c.stake);
 }
 return {day,add,week,japanDay,expiry,visible,validate};
});
