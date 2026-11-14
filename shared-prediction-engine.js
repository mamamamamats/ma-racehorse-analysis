/* One scoring implementation for public, admin and saved prediction snapshots. */
(function(root){
 'use strict';
 const KEYS=['overall','venue','distance','condition','form','lap'],VERSION='shared-six-v2';
 function mode(going){return going==='稍重'?'yielding':['重','不良'].includes(going)?'heavy':'good';}
 function parseLap(r){const m=String(r.review||'').match(/ラップ(?:タイム)?(?:は|[:：])?\s*([0-9]+\.[0-9]+(?:\s*[-－―–→,、]\s*[0-9]+\.[0-9]+){2,})/);if(!m)return null;const laps=(m[1].match(/\d+\.\d+/g)||[]).map(Number),distance=Number(r.raceRef?.distance);if(!distance||distance%100||laps.length!==Math.ceil(distance/200)||laps.some(x=>!Number.isFinite(x)||x<4||x>35))return null;const segments=laps.map((_,i)=>i?200:distance%200||200),time=String(r.review||'').match(/(\d+)分(\d{1,2})秒(\d)?/);if(time&&Math.abs(laps.reduce((a,b)=>a+b,0)-(Number(time[1])*60+Number(time[2])+(Number(time[3])||0)/10))>1)return null;return {record:r,laps,segments,distance};}
 const dateKey=v=>{const m=String(v||'').match(/(20\d{2})\D*(\d{1,2})\D*(\d{1,2})/);return m?m[1]+m[2].padStart(2,'0')+m[3].padStart(2,'0'):'';};
 function profile(context,reviews,LM){const choice=LM.resolveClass(context.lapClass||'auto',context.grade);const rows=reviews.filter(r=>{const x=r.raceRef||{},d=dateKey(x.date);return d&&d<context.date&&x.venue===context.venue&&x.surface===context.surface&&Number(x.distance)===Number(context.distance)&&x.trackCondition===context.going&&LM.matchesClass(x.grade,choice)});return {choice,profile:LM.meanProfile(rows.map(parseLap).filter(Boolean)),rows};}
 function calculate(input,helpers){
  const {LM,evalScore,trackStats,conditionStats,formAvg,extractSurface}=helpers;
  const weights=Object.fromEntries(KEYS.map(k=>[k,Math.max(0,Math.min(6,Number(input.weights?.[k])||0))]));
  const context={...input.context},basis=profile(context,input.reviews||[],LM),horseMap=new Map(input.horses.map(h=>[h.name,h]));
  const rows=input.entries.map((entry,i)=>{
   const name=entry.name||entry.horseName||'',num=entry.num??entry.number??i+1,h=horseMap.get(name),factors=Object.fromEntries(KEYS.map(k=>[k,null]));
   if(!h)return {name,num,frame:entry.frame||0,known:false,factors,score:null,customScore:null,baseScore:null,bonusScore:0};
   const allRaces=h.races||[],scoringRaces=input.surfaceFilter?allRaces.filter(r=>extractSurface(r.track)===context.surface):allRaces;
   const overall=scoringRaces.map(r=>evalScore(r.eval)).filter(v=>v!=null&&Number.isFinite(v));factors.overall=overall.length?overall.reduce((a,b)=>a+b,0)/overall.length:null;
   const venueStats=trackStats(h,context.venue,'',context.surface),distanceStats=trackStats(h,'',String(context.distance||''),context.surface),condition=conditionStats(h,'','',context.surface,mode(context.going));
   const lapStats=LM.horseAptitude(h,input.reviews||[],basis.profile?.pattern,{surface:context.surface,before:context.date,parse:parseLap});
   factors.venue=venueStats.avg;factors.distance=distanceStats.avg;factors.condition=condition.avg;factors.form=formAvg(allRaces.slice(0,3));factors.lap=lapStats.avg;
   let sum=0,den=0;for(const k of KEYS){if(factors[k]==null||!Number.isFinite(factors[k])||weights[k]<=0)continue;sum+=factors[k]*weights[k];den+=weights[k];}
   return {name,num,frame:entry.frame||0,known:true,factors,baseScore:den?sum/den:null,bonusScore:0,venueStats,distanceStats,conditionStats:condition,lapStats,overallAvg:factors.overall,formAvg:factors.form,formCount:allRaces.slice(0,3).filter(r=>evalScore(r.eval)!=null).length,cond:trackStats(h,context.venue,String(context.distance||''),context.surface),shortNote:h.shortNote||'',comments:scoringRaces.slice(0,5).map(r=>r.comment).filter(Boolean),races:scoringRaces,allRaces,surface:context.surface};
  });
  const candidates=Object.fromEntries(['venue','distance','condition'].map(k=>[k,rows.filter(h=>h.known&&h[k+'Stats']?.count>=3&&h[k+'Stats'].avg>=3)]));
  for(const h of rows){h.highConditionKeys=[];h.uniqueHighKeys=[];h.highConditionBonus=0;h.uniqueHighBonus=0;for(const k of ['venue','distance','condition']){if(weights[k]<=0||!candidates[k].includes(h))continue;const stat=h[k+'Stats'],w=weights[k]/6;h.highConditionKeys.push(k);h.highConditionBonus+=(1.2+Math.max(0,Math.min(1.5,(stat.avg-3)*.55)))*w;if(candidates[k].length===1){h.uniqueHighKeys.push(k);h.uniqueHighBonus+=1.5*w;}}h.bonusScore=h.highConditionBonus+h.uniqueHighBonus;h.score=h.baseScore==null?null:h.baseScore+h.bonusScore;h.customScore=h.score;h.highCondition=!!h.highConditionKeys.length;h.uniqueHighCondition=!!h.uniqueHighKeys.length;h.conditionReliability=Math.max(h.venueStats?.count||0,h.distanceStats?.count||0,h.conditionStats?.count||0)>=3?'高':'なし';}
  const ranked=rows.slice().sort((a,b)=>(b.score??-Infinity)-(a.score??-Infinity)||Number(a.num)-Number(b.num)||a.name.localeCompare(b.name,'ja'));
  ranked.forEach((h,i)=>{h.rank=h.score==null?null:i+1;});
  const signature=JSON.stringify([VERSION,context,weights,!!input.surfaceFilter,basis.profile,ranked.map(h=>[h.num,h.name,h.factors,h.baseScore,h.bonusScore,h.lapStats?.used])]);let hash=2166136261;for(let i=0;i<signature.length;i++)hash=Math.imul(hash^signature.charCodeAt(i),16777619)>>>0;
  return {rows,ranked,basis,weights,context,fingerprint:VERSION+'-'+hash.toString(16)};
 }
 const api={KEYS,VERSION,mode,parseLap,dateKey,profile,calculate};if(typeof module==='object'&&module.exports)module.exports=api;else root.SharedPredictionEngine=api;
})(globalThis);
