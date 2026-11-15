/* Date-level race going edits, preserving all unrelated race data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DayGoingModel=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const choices=['良','稍重','重','不良'];
 const goingFor=r=>choices.includes(r.trackCondition)?r.trackCondition:(String(r.track||'').match(/不良|稍重|重|良/)?.[0]||'良');
 const surface=r=>/障/.test(r.track||'')?'障':/ダ/.test(r.track||'')?'ダ':/芝/.test(r.track||'')?'芝':'';
 const key=(venue,r)=>JSON.stringify([venue,Number(r)]);
 function rows(day){return (day.venues||[]).flatMap(v=>(v.races||[]).map(r=>({key:key(v.name,r.r),venue:v.name,r:Number(r.r),name:r.name||'',surface:surface(r),before:goingFor(r),after:goingFor(r),registered:choices.includes(r.trackCondition),track:r.track||''})));}
 function apply(day,changes,now){const result={...day,venues:(day.venues||[]).map(v=>({...v,races:(v.races||[]).map(r=>({...r}))}))},seen=new Set();let updated=0;for(const change of changes){if(!choices.includes(change.after))throw Error('馬場状態が不正です');if(seen.has(change.key))throw Error('対象レースが重複しています');seen.add(change.key);const matches=(result.venues||[]).flatMap(v=>(v.races||[]).filter(r=>key(v.name,r.r)===change.key));if(matches.length!==1)throw Error(change.venue+' '+change.r+'Rが変更・削除されています。開き直してください');const race=matches[0],current=goingFor(race);if(current!==change.before&&current!==change.after)throw Error(change.venue+' '+change.r+'Rの馬場が別端末で更新されています。開き直してください');if(current===change.after&&race.trackCondition===change.after)continue;race.trackCondition=change.after;race.track=String(race.track||'').replace(/不良|稍重|重|良/g,'').trim()+change.after;race.trackConditionUpdatedAt=now;updated++;}return {day:result,updated};}
 return {choices,goingFor,surface,key,rows,apply};
});
