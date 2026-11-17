/* Read-only podium profiles from the selected saved-prediction cohort. */
(()=>{
 'use strict';if(isEditMode)return;
 const T=window.PodiumTraitsModel,F=window.PredictionReviewModel.factors,E=v=>publicEscape(String(v??''));let data=null;
 const format=(s,d=2)=>s.average==null?'—':s.average.toFixed(d);

 window.reloadPublicConditionTraits=()=>{window.DataArchive?.refresh();load();};
 async function load(){await window.PA.loadVerification();render();}

 function render(){const root=document.getElementById('publicProfileSlot');if(!root||currentView!=='publicResults')return;data=window.PA.traitData();document.getElementById('publicConditionTraits')?.remove();const node=document.createElement('section');node.id='publicConditionTraits';node.className='pct pa';root.prepend(node);
  const head='<div class="pct-heading"><div><div class="pa-eyebrow">PODIUM PROFILE</div><h2>好走馬の平均プロファイル</h2><p class="pa-muted">上の採点モデル・馬場・保存タイミングで選んだ、実際の1〜3着馬を比較します。</p></div><button type="button" class="pa-btn secondary" onclick="reloadPublicConditionTraits()">更新</button></div>';
  if(!data){node.innerHTML=head+`<div class="pct-empty">上の「スコア検証データを読み込む」から、保存済み予想と結果を読み込んでください。</div>`;return;}
  const stats=T.combine(data.groups);
  node.innerHTML=head+`<div class="pct-kpis"><div>対象レース<b>${stats.races}<small>R</small></b></div><div>平均に含む好走馬<b>${stats.count}<small>頭</small></b></div><div>好走馬の平均総合点<b>${format(stats.score)}<small>点</small></b><span>確認 ${stats.score.count}頭</span></div></div>${stats.count?`<div class="pct-layout"><article class="pct-radar"><h3>好走馬の平均プロファイル</h3>${publicRadar({name:'好走馬の平均',factors:Object.fromEntries(F.map(([k])=>[k,stats.factors[k].average]))})}<p class="pa-muted">各項目0〜6。未確認の軸は点線。総合点には適性加点が含まれます。</p></article><article class="pct-axes">${F.map(([k,label])=>`<div><small>${E(label)}</small><b>${format(stats.factors[k])}</b><span>${stats.factors[k].count}頭で確認</span></div>`).join('')}<p class="pct-base-note">基礎点平均 ${format(stats.baseScore)} ／ 適性加点平均 ${format(stats.bonusScore)}</p></article></div><article class="pct-position"><div><div class="pa-eyebrow">RACE POSITION</div><h3>好走馬の平均位置取り</h3><p class="pa-muted">最終角（最後の通過位置）で比較</p></div><div class="pct-position-values"><strong>${format(stats.position,1)}<small>番手</small></strong><span>数値確認 ${stats.position.count}頭</span>${stats.relativePosition.average!=null?`<b>前から ${format(stats.relativePosition,1)}%</b><span>頭数確認 ${stats.relativePosition.count}頭</span>`:'<span>頭数不足のため相対位置は未確認</span>'}</div>${stats.relativePosition.average!=null?`<div class="pct-position-track"><i style="left:${Math.max(0,Math.min(100,stats.relativePosition.average))}%"></i></div><div class="pct-position-ends"><span>前 0%</span><span>後ろ 100%</span></div>`:'<div class="pct-empty">コーナー順位と頭数が揃うと、位置取りの傾向が表示されます。</div>'}</article>`:'<div class="pct-empty">この条件では、集計できる好走馬がまだありません。</div>'}<p class="pct-footnote">好走馬＝実際の3着以内。回顧F確認分 ${stats.excludedF}頭は評価平均から除外、回顧評価未確認は${stats.unknownEval}頭。予想保存時のスコアを使用し、未評価・位置不明は0にしません。<br>数字のある通過順のみを位置取り平均に使用。頭数が分かる記録は相対位置も計算します。${stats.races<5?'件数が少ないため参考値です。':''} 保存済み予想・結果から集計（公開用の手動更新は不要）</p>`;
 }
 const previous=renderPublicResults;renderPublicResults=()=>{previous();render();};
 window.renderPublicConditionTraits=render;
})();
