/* Independent matching of incomplete reviews to a complete official history.
 * Missing reviews are allowed. Never align arrays, infer by order, or eliminate other reviews. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./horse-review-link'):root.HorseReviewLink);if(typeof module==='object'&&module.exports)module.exports=api;else root.HistoricalReviewMatcher=api;})(globalThis,L=>{
 'use strict';
 const norm=v=>String(v||'').normalize('NFKC').replace(/[\s　・･()（）]/g,'');
 function title(v){return norm(v).replace(/20\d{2}[\/年.-]\d{1,2}[\/月.-]\d{1,2}日?/g,'').replace(/ステークス/g,'S').replace(/カップ/g,'C').replace(/トロフィー/g,'T').replace(/ハンデキャップ/g,'H').replace(/以上/g,'上');}
 function cls(v){const t=title(v),m=t.match(/(\d)歳(上)?/),age=m?m[1]+(m[2]?'+':''):'';return {age,kind:/新馬|メイクデビュー/.test(t)?'new':/未勝利/.test(t)?'un':t.match(/([123])勝クラス/)?.[1]||(/500万下/.test(t)?'1':/1000万下/.test(t)?'2':/1600万下/.test(t)?'3':'')};}
 function titleMatch(a,b){const x=cls(a),y=cls(b);if(x.kind||y.kind)return !!x.kind&&x.kind===y.kind&&(!x.age||x.age===y.age);return title(a)===title(b);}
 function going(run){return String(run.track||'').match(/不良|稍重|重|良/)?.[0]||'';}
 function finish(run){const first=norm(run.comment||'').replace(/(十八|十七|十六|十五|十四|十三|十二|十一|十|九|八|七|六|五|四|三|二|一)着/g,(m,k)=>String(['','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八'].indexOf(k))+'着').split(/[。！？\n]/)[0]||'';if(/^(?:勝ち馬|[1-9]着馬|他馬|上位馬)/.test(first))return null;const all=[...first.matchAll(/(?<![\d,、〜～~])([1-9]\d?)着(?!馬)/g)].map(m=>Number(m[1]));return all.length===1?all[0]:null;}
 function reviewCourse(run){const c=L.course(run);if(L.runDate(run)){const fromTitle=L.course({track:run.name});for(const k of ['venue','surface','distance'])if(!c[k]&&fromTitle[k])c[k]=fromTitle[k];}return c;}
 function courseMatch(a,b){if(/障害/.test(String(a.name||'')+String(a.track||''))!==/障害/.test(String(b.name||'')+String(b.track||'')))return false;const x=reviewCourse(a),y=L.course({track:b.venue+(b.track||'')});return !!x.venue&&!!x.surface&&!!x.distance&&x.venue===y.venue&&x.surface===y.surface&&x.distance===y.distance;}
 function match(run,history,cards){
  if(run.raceId)return {status:'already-linked'};
  if(!history?.complete)return {status:'incomplete-official-history'};
  const named=cls(run.name).kind==='',observed=finish(run),date=L.runDate(run);
  const official=history.races.filter(r=>courseMatch(run,r)&&titleMatch(run.name,r.name)&&(!going(run)||going(run)===r.going)&&(!date||date===L.date(r.date))&&(observed==null||observed===r.finish));
  if(official.length!==1)return {status:official.length?'ambiguous-official-races':'no-official-match',officialCandidates:official};
  if(!named&&observed==null&&!date)return {status:'generic-without-own-finish',officialCandidates:official};
  const r=official[0],targets=cards.filter(c=>L.date(c.date)===L.date(r.date)&&c.venue===r.venue&&courseMatch(run,c)&&titleMatch(run.name,c.name));
  if(targets.length!==1)return {status:targets.length?'ambiguous-app-race':'missing-app-race',officialCandidates:official};
  return {status:'confirmed',official:r,card:targets[0],evidence:['official-horse-history','app-starting-list','race-name','course',...(observed!=null?['own-finish']:[]),...(going(run)?['going']:[]),...(date?['date-in-review']:[])]};
 }
 function matchHorse(horse,history,cards){
  if(L.norm(horse.name)!==L.norm(history.name))return (horse.races||[]).map(()=>({status:'horse-name-mismatch'}));
  if(!history.complete)return (horse.races||[]).map(()=>({status:'incomplete-official-history'}));
  const today=history.asOf||new Date(Date.now()+9*3600000).toISOString().slice(0,10),cutoff=L.date(today),latestOfficial=history.races.map(r=>L.date(r.date)).sort().at(-1)||'',latestCard=cards.map(r=>L.date(r.date)).filter(d=>d&&d<=cutoff).sort().at(-1)||'';
  if(latestCard&&latestOfficial<latestCard)return (horse.races||[]).map(()=>({status:'official-history-not-current'}));
  const anchors=(horse.races||[]).filter(r=>L.runDate(r)&&/新馬|メイクデビュー/.test(r.name||''));
  if(anchors.length&&!anchors.some(r=>history.races.some(x=>{if(L.runDate(r)!==L.date(x.date)||cls(x.name).kind!=='new')return false;const a=reviewCourse(r),b=L.course({track:x.venue+x.track}),f=finish(r);const keys=['venue','surface','distance'].filter(k=>a[k]);return keys.every(k=>a[k]===b[k])&&(keys.length>=2||keys.length>=1&&f!=null&&f===x.finish); })))return (horse.races||[]).map(()=>({status:'horse-identity-anchor-mismatch'}));
  const results=(horse.races||[]).map(r=>match(r,history,cards)),targets=new Map(),occupied=new Set((horse.races||[]).map(r=>r.raceId).filter(Boolean));
  for(let i=0;i<results.length;i++)if(results[i].status==='confirmed'&&occupied.has(results[i].card.raceId))results[i]={...results[i],status:'duplicate-review-target'};
  results.forEach((r,i)=>{if(r.status==='confirmed'){const id=r.card.raceId;if(!targets.has(id))targets.set(id,[]);targets.get(id).push(i);}});
  for(const indices of targets.values())if(indices.length>1)for(const i of indices)results[i]={...results[i],status:'duplicate-review-target'};
  return results;
 }
 return {norm,title,cls,titleMatch,going,finish,reviewCourse,courseMatch,match,matchHorse};
});
