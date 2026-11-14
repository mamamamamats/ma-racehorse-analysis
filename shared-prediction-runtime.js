/* Shared data loading and adapters. No automatic writes. */
(() => {
 'use strict';
 const E=window.SharedPredictionEngine,LM=window.RaceLapMetrics;
 let reviews=null,loading=null,lastResult=null;
 async function ensure(){if(reviews)return reviews;if(loading)return loading;loading=(async()=>{if(!(await waitForFirebase(5000)))throw Error('共通採点用のラップデータを読み込めませんでした');const {collection,query,orderBy,limit,startAfter,getDocs}=window._fbFns;const all=[];let cursor=null;while(true){const cs=[orderBy('__name__'),limit(100)];if(cursor)cs.push(startAfter(cursor));const snap=await getDocs(query(collection(window._fbDb,'raceReviews'),...cs));all.push(...snap.docs.map(d=>({...d.data(),_docId:d.id})));if(snap.docs.length<100)break;cursor=snap.docs.at(-1);}reviews=all;return all;})();try{return await loading;}finally{loading=null;}}
 function context(day,venue,race,going,lapClass='auto'){return {date:E.dateKey(day.date||day.id),venue:venue.name,surface:aiExtractSurface(race.track),distance:Number(aiExtractDistance(race.track))||0,grade:race.grade||race.raceClass||race.class||'',going,lapClass};}
 function calculate(day,venue,race,{weights,going,surfaceFilter=false,lapClass='auto'}={}){
  if(!reviews)throw Error('共通採点データを読み込み中です。完了後に再試行してください');
  lastResult=E.calculate({horses,entries:race.horses||[],reviews,context:context(day,venue,race,going,lapClass),weights,surfaceFilter},{LM,evalScore:aiEvalScore,trackStats:aiTrackStats,conditionStats:aiConditionStats,formAvg:aptAvg,extractSurface:aiExtractSurface});return lastResult;
 }
 const goingFor=race=>race.trackCondition||(/不良|稍重|重|良/.test(race.track||'')?aiGetTrackCondition(race.track):'良');
 window.SharedPredictionRuntime={ensure,calculate,goingFor,get reviews(){return reviews;},version:E.VERSION};
 aiCustomWeights.lap=3;
 window.aiLapClass='auto';window.aiSelectedGoing='良';
 aiBuildRaceData=(day,venue,race)=>calculate(day,venue,race,{weights:aiCustomWeights,going:E.mode(window.aiSelectedGoing)===aiConditionMode?window.aiSelectedGoing:aiConditionMode==='yielding'?'稍重':aiConditionMode==='heavy'?'重':'良',surfaceFilter:aiSurfaceFilterEnabled,lapClass:window.aiLapClass}).ranked;
 const oldFactor=aiPredictionFactorSnapshot;
 aiPredictionFactorSnapshot=c=>({...oldFactor(c),lap:c.factors?.lap??null});
 const oldRecord=aiBuildPredictionRecord;
 aiBuildPredictionRecord=(day,venue,race)=>{const record=oldRecord(day,venue,race);record.engineVersion=E.VERSION;record.weights={...lastResult.weights};record.conditionMode=E.mode(lastResult.context.going);record.lapClass=lastResult.context.lapClass;record.targetGoing=lastResult.context.going;record.lapBasis={choice:lastResult.basis.choice,profile:lastResult.basis.profile,referenceRaceIds:lastResult.basis.rows.map(r=>r.raceId||r._docId)};record.inputFingerprint=lastResult.fingerprint;record.horses=record.horses.map(h=>{const row=lastResult.rows.find(x=>String(x.num)===String(h.num));return {...h,baseScore:row?.baseScore??null,bonusScore:row?.bonusScore??0}});return record;};
 const oldOpen=openAIPredictor;
 openAIPredictor=async(dayId,venueName,rNum)=>{try{await ensure();const d=raceDays.find(d=>d.id===dayId),r=d?.venues?.find(v=>v.name===venueName)?.races?.find(r=>Number(r.r)===Number(rNum));if(r){window.aiSelectedGoing=goingFor(r);aiConditionMode=E.mode(window.aiSelectedGoing);}window.aiLapClass='auto';oldOpen(dayId,venueName,rNum);}catch(e){showToast('⚠ '+e.message,true)}};
 const oldSave=saveCurrentPrediction;
 saveCurrentPrediction=async()=>{try{await ensure();await oldSave();}catch(e){showToast('⚠ '+e.message,true)}};
 const previousModeSetter=aiSetConditionMode;aiSetConditionMode=mode=>{window.aiSelectedGoing=mode==='good'?'良':mode==='yielding'?'稍重':window.aiSelectedGoing==='不良'?'不良':'重';previousModeSetter(mode)};
 const oldPrediction=aiMakePrediction;aiMakePrediction=(day,venue,race)=>{const html=oldPrediction(day,venue,race);const r=lastResult;return html+`<div class="ai-predict-note">共通採点：${E.VERSION}／入力識別 ${aiEsc(r.fingerprint)}<br>${r.ranked.map((h,i)=>`${i+1}位 ${aiEsc(h.name)}：総合${h.score==null?'未評価':h.score.toFixed(2)}（基礎${h.baseScore==null?'—':h.baseScore.toFixed(2)}＋加点${h.bonusScore.toFixed(2)}／ラップ${h.factors.lap==null?'未評価':h.factors.lap.toFixed(2)}）`).join('<br>')}</div>`;};
 window.resetSharedPredictionDefaults=()=>{aiCustomWeights=Object.fromEntries(E.KEYS.map(k=>[k,3]));window.aiSelectedGoing=goingFor(aiPredictionContext?.[2]||{});aiConditionMode=E.mode(window.aiSelectedGoing);aiSurfaceFilterEnabled=false;window.aiLapClass='auto';aiRenderPredictionBody();};
 const oldPanel=aiWeightPanel;
 aiWeightPanel=()=>oldPanel()+`<div class="ai-style-panel"><button type="button" class="ai-style-btn" onclick="resetSharedPredictionDefaults()">一般モードの初期設定に合わせる</button><label>ラップ適性の重み（0〜6）：<b id="aiLapWeight">${aiCustomWeights.lap??3}</b><input aria-label="編集のラップ適性の重み" type="range" min="0" max="6" value="${aiCustomWeights.lap??3}" oninput="aiSetCustomWeight('lap',this.value)"></label><label>採点する馬場<select aria-label="編集の採点馬場" onchange="window.aiSelectedGoing=this.value;aiConditionMode=window.SharedPredictionEngine.mode(this.value);aiRenderPredictionBody()">${['良','稍重','重','不良'].map(g=>`<option ${g===window.aiSelectedGoing?'selected':''}>${g}</option>`).join('')}</select></label><label>ラップ比較クラス<select aria-label="編集のラップ比較クラス" onchange="window.aiLapClass=this.value;aiRenderPredictionBody()">${LM.classOptions.map(([k,l])=>`<option value="${k}" ${window.aiLapClass===k?'selected':''}>${aiEsc(l)}</option>`).join('')}</select></label><small>表示・個別登録・日付一括登録は共通6項目エンジン。データ・設定が同じ場合に点数・順位が一致します。</small></div>`;
})();
