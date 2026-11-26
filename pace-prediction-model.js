/* Scenario selection is separate from the unchanged six-axis score. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PacePredictionModel=api;})(globalThis,()=>{
 'use strict';const VERSION='lap-selection-v1',labels={front_loaded:'前傾',back_loaded:'後傾',even:'平均型'},patterns=Object.keys(labels);
 const pattern=v=>patterns.includes(v)?v:null;
 const sort=(a,b)=>b.selectionScore-a.selectionScore||Number(a.num)-Number(b.num);
 function select({result,evidence=[],cohort=[],minRuns=2,minRaces=5}){
  const known=result.ranked.filter(h=>Number.isFinite(h.score)),counts=Object.fromEntries(patterns.map(p=>[p,0])),seen=new Set();
  for(const r of cohort){const p=pattern(r.pattern);if(p&&!seen.has(r.raceId)){seen.add(r.raceId);counts[p]++;}}
  const n=seen.size,profile=result.basis?.profile,mainPattern=n>=minRaces&&profile?.count>=minRaces?pattern(profile.pattern):null;
  const byHorse=new Map();for(const e of evidence){const p=pattern(e.pattern);if(!p||!Number.isFinite(e.value)||e.value<0||e.value>6)continue;const key=String(e.num)+'|'+p;if(!byHorse.has(key))byHorse.set(key,new Map());byHorse.get(key).set(e.raceId,e);}
  const scenarios=patterns.map(p=>{const rows=known.map(h=>{
   const runs=[...(byHorse.get(String(h.num)+'|'+p)?.values()||[])],w=Number(result.weights.lap)||0,eligible=runs.length>=minRuns&&w>0;
   let score=h.score;const average=runs.length?runs.reduce((s,r)=>s+r.value,0)/runs.length:null;
   if(eligible){let sum=0,den=0;for(const k of Object.keys(result.weights)){const v=k==='lap'?average:h.factors[k],weight=result.weights[k];if(v!=null&&Number.isFinite(v)&&weight>0){sum+=v*weight;den+=weight;}}score=den?sum/den+(h.bonusScore||0):h.score;}
   return {num:h.num,name:h.name,scoreRank:h.rank,originalScore:h.score,selectionScore:score,eligible,average,count:runs.length,sourceRuns:runs.map(r=>({date:r.date||'',name:r.raceName||'',eval:r.eval||''})),raceIds:runs.map(r=>r.raceId)};
  }).sort(sort);return {pattern:p,label:labels[p],rows};});
  // Keep score order unless both sides of an inversion have comparable pace evidence.
  const main=known.map(h=>({num:h.num,name:h.name,scoreRank:h.rank,originalScore:h.score,selectionScore:h.score}));
  if(mainPattern){const scenario=scenarios.find(s=>s.pattern===mainPattern);const slots=main.map((h,i)=>scenario.rows.find(r=>String(r.num)===String(h.num))?.eligible?i:-1).filter(i=>i>=0);const candidates=scenario.rows.filter(h=>h.eligible);slots.forEach((slot,i)=>main[slot]=candidates[i]);}
  const picks=main.slice(0,5).map((h,i)=>({...h,rank:i+1,mark:['◎','○','▲','△','△'][i],role:'main',reason:mainPattern&&h.eligible?`${labels[mainPattern]}の過去評価 ${h.average.toFixed(2)}（${h.count}走）。比較可能な馬の間で印を調整。`:'スコア順。ラップ構成別比較の根拠不足時は据え置き。'}));
  const selected=new Set(picks.map(h=>String(h.num))),stars=new Map();
  for(const s of scenarios){if(s.pattern===mainPattern||s.rows.length<2)continue;const winner=s.rows[0];
   // Do not claim sole ◎ on a tie, or when any rival lacks comparable evidence.
   if(!s.rows.every(h=>h.eligible)||winner.selectionScore-s.rows[1].selectionScore<1e-8||selected.has(String(winner.num)))continue;
   let star=stars.get(String(winner.num));if(!star){star={...winner,mark:'☆',role:'alternative',conditions:[],reason:''};stars.set(String(winner.num),star);}star.conditions.push({pattern:s.pattern,label:s.label,count:winner.count,average:winner.average,score:winner.selectionScore,raceIds:winner.raceIds,sourceRuns:winner.sourceRuns});
  }
  for(const star of stars.values()){star.rank=picks.length+1;star.reason=star.conditions.map(c=>`${c.label}想定なら◎／過去評価 ${c.average.toFixed(2)}（${c.count}走）`).join('。');picks.push(star);}
  const fieldStyles={escape:0,forward:0,mixed:0,unknown:0};for(const h of result.ranked){const s=h.runningStyle;const label=s?.label||'';if(!s?.known)fieldStyles.unknown++;else if(label==='逃げ中心')fieldStyles.escape++;else if(label==='先行中心')fieldStyles.forward++;else fieldStyles.mixed++;}
  return {version:VERSION,fieldStyles,mainPattern,mainBasis:profile?{pattern:profile.pattern,count:profile.count,delta:profile.delta}:null,counts,referenceRaces:n,minRuns,minRaces,picks,scenarios,notes:'暫定ルール：同条件の平均ラップ5R以上から、6要素のラップ適性と同じ前傾・後傾・平均型を本線にする。各型の過去評価でラップ軸を置換し二重加点しない。逃げ・先行頭数から型は変更しない。☆は全評価馬に2走以上の比較根拠がある場合の単独1位のみ。'};
 }
 return {VERSION,labels,pattern,select};
});
