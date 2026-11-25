/* Same resolver in badges and scoring; writes happen only on explicit editor action. */
(()=>{
 'use strict';
 const L=window.HorseReviewLink,E=v=>escHtml(String(v??''));
 const oldBadges=horseRaceEventBadges;
 horseRaceEventBadges=r=>{
  const records=[...raceWholeReviewCache.values(),...(raceConditionReviewRecords||[])],match=L.resolve(r,records,{horseName:selectedHorse?.races?.includes(r)?selectedHorse.name:'',days:raceDays||[]});
  const text=match.status==='verified'?'JRA公式履歴・回顧本文・出馬表で照合済み（ラップ採点に利用／ID未保存）':match.status==='inferred'?'日付・競馬場・コースで照合済み（ラップ採点で照合可能／ID未保存）':match.status==='ambiguous'?'候補が複数あるため未連携。編集モードで開催日・R番号を確認してください。':match.status==='insufficient'?'開催日などが不足しているため未連携。編集モードで対象レースを選択してください。':match.status==='conflict'?'日付・コース・R番号または出馬表との不一致があるため連携保留（ラップ採点対象外）。':match.status==='missing'?'保存済みIDの全体回顧が見つかりません。':match.status==='unmatched'?'一致する全体回顧がありません。':'';
  const completion=match.record&&window.ReviewClassificationRuntime?.get(match.record),auto=completion?.fields?.length?'実数ラップから不足分類を自動補完（枠・不利は補完しません）':match.record?.lapPatternMeta?.source==='auto-half'?'ラップ構成：実数ラップの前後半比較による自動分類':'';
  const official=/^https:\/\/www\.jra\.go\.jp\/JRADB\/accessU\.html\?/.test(match.verification?.url||'')?'<p class="rr-meta"><a href="'+E(match.verification.url)+'" target="_blank" rel="noopener noreferrer">照合したJRA公式履歴を見る</a></p>':'';
  return oldBadges(r)+official+(auto?'<p class="rr-meta">'+E(auto)+'</p>':'')+(text?'<p class="rr-meta horse-link-status">'+E(text)+'</p>':'');
 };
 const oldRefresh=horseRaceRefreshEventBadges;
 horseRaceRefreshEventBadges=()=>{
  oldRefresh();const root=document.getElementById('horseDetailEl');if(!root||!selectedHorse||!isEditMode)return;
  let tools=root.querySelector('.horse-link-tools');if(!tools){tools=document.createElement('section');tools.className='horse-link-tools rr-preview-card';root.prepend(tools);}
  const runs=selectedHorse.races||[],records=raceConditionReviewRecords||[],results=runs.map(r=>L.resolve(r,records,{horseName:selectedHorse?.races?.includes(r)?selectedHorse.name:'',days:raceDays||[]})),inferred=results.filter(x=>['inferred','verified'].includes(x.status)).length,linked=results.filter(x=>x.status==='linked').length;
  tools.innerHTML='<b>過去走とレース全体回顧の紐付け</b><p class="rr-meta">'+runs.length+'走：ID連携 '+linked+'／自動・公式照合 '+inferred+'／要確認 '+(runs.length-linked-inferred)+'。4分類は全体回顧を参照し、ラップ適性には同じ照合結果を使用します。</p><button type="button" class="review-ai-btn secondary" onclick="saveCurrentHorseReviewLinks(this)" '+(!inferred?'disabled':'')+'>この馬の確実に一致した '+inferred+'走の紐付けを保存</button><span role="status"></span>';
 };
 window.saveCurrentHorseReviewLinks=async button=>{
  const h=selectedHorse;if(!h||!isEditMode)return;const status=button.parentElement.querySelector('[role=status]'),records=raceConditionReviewRecords||[],plan=(h.races||[]).map(r=>({original:{...r},match:L.resolve(r,records,{horseName:selectedHorse?.races?.includes(r)?selectedHorse.name:'',days:raceDays||[]})})).filter(x=>x.match.status==='inferred');
  button.disabled=true;let saved=0,failed=0;
  try{for(const item of plan){const record=item.match.record,id=L.idOf(record),result=await saveHorseRaceChange(h.name,{type:'update',original:item.original,updated:{...item.original,raceId:id,raceRef:{...(record.raceRef||{})}}});if(result.ok){saved++;applySavedHorseToCurrentState(result.horse);}else failed++;status.textContent=' 保存 '+saved+'／保留 '+failed;}
   invalidateHorseCache();if(selectedHorse?.name===h.name)horseRaceRefreshEventBadges();showToast('紐付け保存 '+saved+'走／保留 '+failed+'走');
  }catch(e){status.textContent='保存できません：'+e.message;}finally{button.disabled=false;}
 };
})();
