/* Pure lap/profile calculations. No storage or network operations. */
(function(root){
  'use strict';
  const SCORE={S:6,A:4,B:3,C:2,D:0,good:4,mid:3,bad:2};
  const LABELS={front_loaded:'前傾',back_loaded:'後傾',even:'平均型'};
  const classOptions=[['auto','今回のレースに合わせる'],['un','未勝利'],['winplus','1勝クラス以上'],['graded','重賞（G1〜G3）'],['new','新馬のみ'],['1s','1勝クラスのみ'],['2s','2勝クラスのみ'],['3s','3勝クラスのみ'],['op','OP・Lのみ'],['g3','G3のみ'],['g2','G2のみ'],['g1','G1のみ'],['all','全クラス']];
  const key=v=>{const m=String(v||'').match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/);return m?m[1]+m[2].padStart(2,'0')+m[3].padStart(2,'0'):String(v||'').replace(/\D/g,'').slice(0,8);};
  function grade(v){const x=String(v||'').toLowerCase().replace(/[\s　_-]/g,'');return ({新馬:'new',未勝利:'un','1勝クラス':'1s','2勝クラス':'2s','3勝クラス':'3s',オープン:'op',リステッド:'op',l:'op','op/l':'op'})[x]||(['new','un','1s','2s','3s','op','g3','g2','g1'].includes(x)?x:'');}
  function resolveClass(choice,target){if(choice&&choice!=='auto')return choice;const g=grade(target);return g==='new'?'new':g==='un'?'un':['g1','g2','g3'].includes(g)?'graded':['1s','2s','3s','op'].includes(g)?'winplus':'all';}
  function matchesClass(value,choice){const g=grade(value);return !choice||choice==='all'?true:choice==='winplus'?['1s','2s','3s','op','g3','g2','g1'].includes(g):choice==='graded'?['g3','g2','g1'].includes(g):g===choice;}
  function splitPattern(laps,segments){
    const distance=segments.reduce((a,b)=>a+b,0);if(!distance||laps.length!==segments.length)return null;
    let position=0,front=0,total=0,interpolated=false;const half=distance/2;
    for(let i=0;i<laps.length;i++){const overlap=Math.max(0,Math.min(position+segments[i],half)-position);front+=laps[i]*overlap/segments[i];total+=laps[i];if(overlap>0&&overlap<segments[i])interpolated=true;position+=segments[i];}
    const back=total-front,delta=(back-front)*200/half;
    // A 0.10 second / 200m deadband is a provisional display convention, not a learned threshold.
    return {pattern:delta>.10+1e-9?'front_loaded':delta<-.10-1e-9?'back_loaded':'even',delta,front200:front*200/half,back200:back*200/half,interpolated};
  }
  function meanProfile(rows){
    if(!rows.length)return null;const first=rows[0],signature=JSON.stringify(first.segments);
    const valid=rows.filter(r=>r.distance===first.distance&&JSON.stringify(r.segments)===signature&&r.laps.every(Number.isFinite));if(!valid.length)return null;
    const laps=first.laps.map((_,i)=>valid.reduce((sum,r)=>sum+r.laps[i],0)/valid.length),pattern=splitPattern(laps,first.segments);
    return {laps,segments:[...first.segments],distance:first.distance,count:valid.length,...pattern};
  }
  function recordPattern(record,parse){const parsed=parse(record);if(parsed)return splitPattern(parsed.laps,parsed.segments)?.pattern||null;
    const raw=record?.events?.lapPattern,values=[...new Set((Array.isArray(raw)?raw:[raw]).filter(x=>Object.hasOwn(LABELS,x)))];return values.length===1?values[0]:null;
  }
  function horseAptitude(horse,reviews,targetPattern,{surface='',before='',parse=()=>null}={}){
    const map=new Map();for(const r of reviews)for(const id of [r.raceId,r._docId].filter(Boolean))map.set(id,r);
    const seen=new Set(),values=[],used=[];let linked=0,matching=0;
    for(const run of horse?.races||[]){const r=run.raceId?map.get(run.raceId):null;if(!r)continue;
      const identity=r.raceId||r._docId;if(seen.has(identity))continue;seen.add(identity);
      const ref=r.raceRef||{},date=key(ref.date);if(before&&(!date||date>=before))continue;if(surface&&ref.surface!==surface)continue;
      linked++;if(!targetPattern||recordPattern(r,parse)!==targetPattern)continue;matching++;
      const ev=String(run.eval||'').trim(),value=SCORE[ev];if(value==null)continue;values.push(value);used.push({raceId:identity,eval:ev,value});
    }
    return {avg:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,count:values.length,linked,matching,total:(horse?.races||[]).length,used};
  }
  const api={SCORE,LABELS,classOptions,grade,resolveClass,matchesClass,splitPattern,meanProfile,recordPattern,horseAptitude};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.RaceLapMetrics=api;
})(globalThis);
