/* Explicit admin action only: read race master, create prediction snapshots, never update existing ones. */
(() => {
 'use strict';
 if(!isEditMode)return;
 const jobs=new Map(),states=new Map();
 const keys=['overall','venue','distance','condition','form','lap'];
 function standard(p,going){return p.engineVersion===window.SharedPredictionEngine.VERSION&&keys.every(k=>Number(p.weights?.[k])===3)&&p.targetGoing===going&&(p.lapClass||'auto')==='auto'&&!p.surfaceFilterEnabled;}
 function eligible(r){const raw=String(r.grade||r.raceClass||r.class||'').toLowerCase().replace(/[\s　_-]/g,'');const normal=window.RaceLapMetrics?.grade(raw)||raw;return /^(1s|2s|3s|op|l|g[123]|jg[123]|[123]勝(?:クラス)?|オープン|リステッド)$/.test(normal);}
 function controls(day){
  const state=states.get(day.id),busy=jobs.has(day.id);
  return `<div class="day-standard-controls" onclick="event.stopPropagation()"><button type="button" class="edit-btn-save" data-day-prediction-button="${aiEsc(day.id)}" onclick="event.stopPropagation();registerDayStandardPredictions(this.dataset.dayPredictionButton)" ${busy?'disabled':''}>${busy?'⏳ 登録中…':'💾 この日の標準予想を登録'}</button><small>新馬・未勝利を除く／重みは全項目3／馬場はレース設定（不明なら良）・芝ダート除外OFF。共通6項目版の登録済み予想は上書きしません（旧版は保持）。出走馬・評価不足はスキップして件数表示します。</small><div role="status" aria-live="polite" data-day-prediction-status="${aiEsc(day.id)}">${aiEsc(state||'')}</div></div>`;
 }
 function update(dayId,text){states.set(dayId,text);for(const el of document.querySelectorAll('[data-day-prediction-status]'))if(el.dataset.dayPredictionStatus===dayId)el.textContent=text;for(const el of document.querySelectorAll('[data-day-prediction-button]'))if(el.dataset.dayPredictionButton===dayId){el.disabled=jobs.has(dayId);el.textContent=jobs.has(dayId)?'⏳ 登録中…':'💾 この日の標準予想を登録';}}
 function build(day,venue,race){
  const previousWeights=aiCustomWeights,previousMode=aiConditionMode,previousFilter=aiSurfaceFilterEnabled,previousGoing=window.aiSelectedGoing,previousClass=window.aiLapClass;
  try{aiCustomWeights={overall:3,venue:3,distance:3,condition:3,form:3,lap:3};window.aiSelectedGoing=window.SharedPredictionRuntime.goingFor(race);aiConditionMode=window.SharedPredictionEngine.mode(window.aiSelectedGoing);window.aiLapClass='auto';aiSurfaceFilterEnabled=false;return aiBuildPredictionRecord(day,venue,race);}
  finally{aiCustomWeights=previousWeights;aiConditionMode=previousMode;aiSurfaceFilterEnabled=previousFilter;window.aiSelectedGoing=previousGoing;window.aiLapClass=previousClass;}
 }
 async function run(dayId){
  let saved=0,existing=0,excluded=0,unready=0,failed=0;const errors=[];
  try{
   const local=(raceDays||[]).find(d=>d.id===dayId);if(!local)throw Error('対象日が端末にありません');
   if(!(await waitForFirebase(5000)))throw Error('Firebaseに接続できませんでした');
   const {doc,getDoc,collection,query,where,getDocs,runTransaction,serverTimestamp}=window._fbFns;
   await window.SharedPredictionRuntime.ensure();
   const remote=await getDoc(doc(window._fbDb,'raceDays',dayId));
   const day=JSON.parse(JSON.stringify(remote.exists()?remote.data():local));
   if(day.id!==dayId)throw Error('保存された開催日のIDが一致しません。データを確認してください');
   const snapshot=await getDocs(query(collection(window._fbDb,'predictions'),where('raceRef.dayId','==',dayId)));
   const old=snapshot.docs.map(d=>({...d.data(),_docId:d.id}));
   const tasks=[];const seen=new Set();
   for(const venue of day.venues||[])for(const race of venue.races||[]){const key=venue.name+'|'+race.r;if(seen.has(key))continue;seen.add(key);if(!eligible(race)){excluded++;continue;}tasks.push({venue,race});}
   for(let i=0;i<tasks.length;i++){
    const {venue,race}=tasks[i],label=venue.name+' '+race.r+'R';
    update(dayId,`${i+1}/${tasks.length}レース処理中：${label}／成功${saved}・登録済み${existing}・失敗${failed}`);
    try{
     const raceId=ensureRaceId(day,venue,race);
     if(old.some(p=>standard(p,window.SharedPredictionRuntime.goingFor(race))&&(p.raceId===raceId||(p.raceRef?.dayId===dayId&&p.raceRef?.venue===venue.name&&Number(p.raceRef?.raceNumber)===Number(race.r))))){existing++;continue;}
     if(!(race.horses||[]).length){unready++;continue;}
     const record=build(day,venue,race);if(!record.horses.some(h=>h.score!=null&&Number.isFinite(h.score))){unready++;continue;}
     const targetId='daystd_v2_'+encodeURIComponent(raceId)+'_'+encodeURIComponent(record.targetGoing);record.predictionId=targetId;record.method={type:'custom',source:'day-bulk-standard',version:1};record.createdAtServer=serverTimestamp();
     const created=await runTransaction(window._fbDb,async tx=>{const target=doc(window._fbDb,'predictions',targetId),snap=await tx.get(target);if(snap.exists())return false;tx.set(target,record);return true;});
     if(created)saved++;else existing++;
    }catch(e){failed++;errors.push(label+'：'+(e.code||e.message));}
    await new Promise(r=>setTimeout(r,0));
   }
   if(saved){analysisPredictionCache=[];analysisAllHistoryLoaded=false;analysisHistoryCursor=null;analysisHistoryHasMore=false;analysisRaceDataRefreshed=false;}
   return `完了：新規登録 ${saved}件／登録済み ${existing}件／対象外・クラス不明 ${excluded}件／出走馬・評価不足 ${unready}件／失敗 ${failed}件。${errors.length?'\n失敗分は同じボタンで再試行できます。\n'+errors.join('\n'):''}`;
  }catch(e){return '⚠ 登録できませんでした：'+(e.code||e.message)+'。通信・権限を確認して再試行してください。';}
 }
 window.registerDayStandardPredictions=dayId=>{
  if(jobs.has(dayId))return jobs.get(dayId);
  // Defer work until the lock is visible, including synchronous validation errors.
  const job=Promise.resolve().then(()=>run(dayId)).then(message=>{jobs.delete(dayId);update(dayId,message);return message;},error=>{jobs.delete(dayId);update(dayId,'⚠ '+error.message);});
  jobs.set(dayId,job);update(dayId,'登録の準備中…');return job;
 };
 const oldWeek=renderWeek;
 renderWeek=()=>{oldWeek();const root=document.getElementById('weekContent');if(!root||selectedDate)return;const dates=getThisWeekDates(),days=(raceDays||[]).filter(d=>dates.includes(d.date)).sort((a,b)=>dateToNum(a.date)-dateToNum(b.date));const cards=root.querySelectorAll('.history-card');days.forEach((day,i)=>cards[i]?.insertAdjacentHTML('beforeend',controls(day)));};
 const oldContent=renderWeekContent;
 renderWeekContent=day=>{oldContent(day);const header=document.querySelector('#weekContent .fade-in > div > div');if(header){header.classList.add('day-standard-header');header.insertAdjacentHTML('beforeend',controls(day));}};
})();
