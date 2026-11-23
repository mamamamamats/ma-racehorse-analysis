/* Evidence from frozen predictions. Flags are investigation prompts, never causal verdicts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PredictionDiagnosisModel=api;})(globalThis,()=>{
 'use strict';
 const categories={missing:'未評価・記録不足',selection:'候補選び・順位付け',confidence:'根拠の薄さ',bonus:'適性加点',condition:'条件設定',factors:'評価要素の見落とし',style:'脚質・展開',evaluation:'回顧評価の基準',other:'その他・原因不明'};
 const statuses={unreviewed:'未確認',investigating:'調査中',testing:'改善案を検証中',resolved:'解決',hold:'保留'};
 const n=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 const known=h=>n(h.score)!=null;
 const top5=h=>Number.isInteger(h.rank)&&h.rank>=1&&h.rank<=5;
 const label=h=>h.name||h.num+'番';
 function diagnose(row){
  const p=row.prediction||{},f=row.favorite||row.outcome?.top||{},good=row.good||[],all=p.horses||[],flags=[];
  const add=(key,title,evidence,next)=>flags.push({key,title,evidence,next});
  const unknown=good.filter(h=>!known(h));
  if(unknown.length)add('missing','好走馬の採点がない',unknown.map(h=>label(h)+'（'+h.finish+'着）').join('、'),'未登録・名称不一致・読み込み漏れを確認。現在の点数で保存予想を補完しない。');
  const inside=good.filter(h=>known(h)&&top5(h)),outside=good.filter(h=>known(h)&&!top5(h));
  if(inside.length)add('selection','候補内の順位付けを確認',inside.map(h=>label(h)+'：予想'+h.rank+'位 → '+h.finish+'着').join('、'),'◎との差を作った要素を確認し、成功レースも含めて順位付けを比較する。');
  if(outside.length)add('selection','好走馬が上位5頭から漏れた',outside.map(h=>label(h)+'：予想'+(h.rank||'順位なし')+' → '+h.finish+'着').join('、'),'過去の好走条件・クラス・実績の鮮度を確認。候補を増やすだけで解決しない。');
  const frozen=p.weightResearch?.entries?.find(h=>Number(h.num)===Number(f.num)),count=n(frozen?.counts?.form);
  if(count!=null&&count<=1)add('confidence','◎の近走評価が少数実績に依存','直近3件のうち採点可能 '+count+'件。全実績数ではありません。','Fの除外理由や、同じ実績が複数要素を支えていないかを確認する。');
  if(!frozen)add('missing','保存時の件数情報がない','旧予想などで根拠件数が未保存。少数実績かどうかは判定できません。','再計算値と保存時の値を混同せず、次回登録から根拠を蓄積する。');
  const base=all.filter(h=>n(h.baseScore)!=null).slice().sort((a,b)=>b.baseScore-a.baseScore||a.num-b.num)[0];
  if(base&&Number(base.num)!==Number(f.num)&&n(f.bonusScore)>0){
   const actual=row.result?.horses?.find(h=>Number(h.num)===Number(base.num)),finish=n(actual?.finish);
   add('bonus','適性加点で本命が入れ替わった','基礎点1位 '+label(base)+(finish!=null?'（'+finish+'着）':'')+' → 総合点1位 '+label(f)+'（'+f.finish+'着）。基礎点のみも同順位は馬番順。','加点なしで改善するかを確認。1Rだけで加点を悪因と決めない。');
  }
  if(p.targetGoing&&row.going&&p.targetGoing!==row.going)add('condition','保存馬場と現在の設定が異なる','保存 '+p.targetGoing+' ／ 現在 '+row.going,'当時の正しい馬場を確認。後日の設定変更の場合もあるため、自動上書きしない。');
  for(const [key,name] of [['overall','全体評価'],['venue','競馬場適性'],['distance','距離適性'],['condition','馬場適性'],['form','近走評価'],['lap','ラップ適性']]){
   const a=n(f.factors?.[key]);if(a==null)continue;
   const higher=good.filter(h=>n(h.factors?.[key])!=null&&h.factors[key]>a+1e-8);
   if(higher.length)add('factors',name+'で好走馬が上回る',higher.map(h=>label(h)+' '+h.factors[key].toFixed(2)+' ／ ◎ '+a.toFixed(2)).join('、'),'この要素の重みを変える案を、当たったレースと別開催でも検証する。差だけで原因とは断定しない。');
  }
  const lap=all.filter(h=>n(h.factors?.lap)!=null).length;
  const styles=[f,...good].map(h=>h.runningStyle?.label).filter(Boolean);
  if(new Set(styles).size>1)add('style','保存脚質が異なる','◎ '+(f.runningStyle?.label||'未保存')+' ／ 好走馬 '+[...new Set(good.map(h=>h.runningStyle?.label||'未保存'))].join('・'),'想定と実際のラップ、位置取り、個別回顧を照合。脚質が違うだけでは展開不利と決めない。');
  return {flags,lapKnown:lap,entries:all.length,podiumKnown:good.filter(known).length,podium:good.length};
 }
 function aggregate(rows){const counts=Object.fromEntries(Object.keys(categories).map(k=>[k,0]));for(const row of rows)for(const key of new Set(diagnose(row).flags.map(f=>f.key)))counts[key]++;return counts;}
 function review(input={},updatedAt=''){return {version:1,status:Object.hasOwn(statuses,input.status)?input.status:'unreviewed',categories:[...new Set((Array.isArray(input.categories)?input.categories:[]).filter(k=>Object.hasOwn(categories,k)))],hypothesis:String(input.hypothesis||'').slice(0,3000),next:String(input.next||'').slice(0,3000),updatedAt};}
 return {categories,statuses,diagnose,aggregate,review};
});
