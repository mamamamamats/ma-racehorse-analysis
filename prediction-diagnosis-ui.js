/* Editor investigation notes use explicit, conflict-checked partial updates. */
(()=>{
 'use strict';if(!isEditMode)return;
 const D=window.PredictionDiagnosisModel,E=v=>escHtml(String(v??'')),rows=new Map();let seq=0;
 function overview(cases){rows.clear();seq=0;const counts=D.aggregate(cases),manual=Object.fromEntries(Object.keys(D.categories).map(k=>[k,cases.filter(r=>(r.prediction.diagnosisReview?.categories||[]).includes(k)).length]));return '<section class="pd-overview"><h4>原因を探す入口</h4><p class="rr-meta">自動抽出は観測事実と確認候補です。原因の確定や重みの自動変更は行いません。下の各レースで根拠・仮説・次の検証を残せます。</p><div class="pd-counts">'+Object.entries(counts).filter(([,v])=>v).map(([k,v])=>'<span>'+E(D.categories[k])+' <b>'+v+'R</b></span>').join('')+'</div><p class="rr-meta">保存済みの手動分類：'+(Object.entries(manual).filter(([,v])=>v).map(([k,v])=>E(D.categories[k])+' '+v+'R').join(' ／ ')||'まだありません')+'（自動候補とは別集計）</p></section>';}
 function caseHTML(row){
  const id='pd-'+(++seq);rows.set(id,row);const d=D.diagnose(row),saved=D.review(row.prediction.diagnosisReview),p=row.prediction;
  return '<section class="pd-case" id="'+id+'"><h4>敗因・予想の間違いを調べる</h4><p class="rr-meta">好走＝1〜3着（F除外）。比較対象 '+d.podium+'頭／採点あり '+d.podiumKnown+'頭。ラップ適性の数値あり '+d.lapKnown+'/'+d.entries+'頭。保存日時：'+E(p.createdAt||'不明')+'。発走前の保存かは日時だけでは保証できません。</p>'+
   '<details class="pd-inputs"><summary>保存時の根拠件数を確認</summary><p class="rr-meta">件数は保存時の情報のみ。各軸は同じレースを重複して使うことがあり、合計は実績数ではありません。過去レースごとの採否・本文は既存予想には未保存です。</p><div class="rr-table-scroll"><table class="rr-metrics-table"><thead><tr><th>馬</th><th>近走の有効件数</th><th>競馬場</th><th>距離</th><th>馬場</th><th>ラップ</th></tr></thead><tbody>'+[row.favorite,...row.good].map(h=>{const e=p.weightResearch?.entries?.find(x=>Number(x.num)===Number(h.num));return '<tr><th>'+E(h.name)+'</th>'+[e?.counts?.form,e?.stats?.venue?.count,e?.stats?.distance?.count,e?.stats?.condition?.count,e?.counts?.lap].map(v=>'<td>'+(v==null?'未保存':E(v)+'件')+'</td>').join('')+'</tr>';}).join('')+'</tbody></table></div></details>'+
   (d.flags.length?'<div class="pd-flags">'+d.flags.map(f=>'<article><b>'+E(f.title)+'</b><p>'+E(f.evidence)+'</p><small>確認・検証：'+E(f.next)+'</small></article>').join('')+'</div>':'<p>保存情報から目立つ問題は抽出できません。個別回顧や未記録の要素を確認してください。</p>')+
   '<details class="pd-notes" '+(p.diagnosisReview?'open':'')+'><summary>原因の仮説・次の検証を記録'+(p.diagnosisReview?'（保存あり）':'')+'</summary><label>検証状況<select data-pd="status">'+Object.entries(D.statuses).map(([k,v])=>'<option value="'+k+'" '+(saved.status===k?'selected':'')+'>'+v+'</option>').join('')+'</select></label><fieldset><legend>原因の分類（複数選択・手動判断）</legend>'+Object.entries(D.categories).map(([k,v])=>'<label><input type="checkbox" value="'+k+'" '+(saved.categories.includes(k)?'checked':'')+'> '+E(v)+'</label>').join('')+'</fieldset><label>根拠と原因の仮説<textarea data-pd="hypothesis" maxlength="3000" rows="3" placeholder="確認した事実と、まだ仮説の内容を分けて記入">'+E(saved.hypothesis)+'</textarea></label><label>次に確認・比較すること<textarea data-pd="next" maxlength="3000" rows="2">'+E(saved.next)+'</textarea></label><button type="button" class="review-ai-btn" onclick="savePredictionDiagnosis(this)">検証メモを保存</button><span role="status">'+(saved.updatedAt?' 保存：'+E(saved.updatedAt):' 未保存')+'</span><p class="rr-meta">この予想に保存します。順位・スコア・回顧は変更しません。自動候補は結果や絞り込みに合わせて再集計されます。</p></details></section>';
 }
 window.savePredictionDiagnosis=async button=>{
  const el=button.closest('.pd-case'),row=rows.get(el.id),status=el.querySelector('[role=status]');if(!row)return;
  const p=row.prediction,id=p._docId||p.predictionId;if(!id){status.textContent='保存できません：予想IDがありません';return;}
  const value=D.review({status:el.querySelector('[data-pd=status]').value,categories:[...el.querySelectorAll('input:checked')].map(e=>e.value),hypothesis:el.querySelector('[data-pd=hypothesis]').value,next:el.querySelector('[data-pd=next]').value},new Date().toISOString());
  button.disabled=true;status.textContent=' 保存中…';
  try{
   if(!(await waitForFirebase(5000)))throw Error('Firebaseに接続できません');
   const {doc,runTransaction}=window._fbFns,ref=doc(window._fbDb,'predictions',id);
   await runTransaction(window._fbDb,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('予想が削除されています');const old=snap.data().diagnosisReview;if(JSON.stringify(old||null)!==JSON.stringify(p.diagnosisReview||null))throw Error('別の画面でメモが更新されています。内容を控えて最新データを再取得してください');tx.update(ref,{diagnosisReview:value,archiveUpdatedAt:value.updatedAt});});
   p.diagnosisReview=value;window.DataArchive?.invalidate('predictions');status.textContent=' 保存しました';el.querySelector('.pd-notes summary').textContent='原因の仮説・次の検証を記録（保存あり）';
   window.dispatchEvent(new CustomEvent('prediction-data-changed',{detail:{collection:'predictions'}}));
  }catch(e){status.textContent=' 保存できません：'+e.message;}finally{button.disabled=false;}
 };
 window.PredictionDiagnosisUI={overview,caseHTML};
})();
