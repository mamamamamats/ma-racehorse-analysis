/* Public presentation and read-only research. No Firebase writes or migrations. */
(() => {
  'use strict';
  if (isEditMode) return;
  const LM=window.RaceLapMetrics;
  const snapshotKeys=Object.keys(publicLabels);
  publicLabels.lap='ラップ適性';publicDraftWeights.lap=3;publicAppliedWeights.lap=3;
  const E = value => publicEscape(value ?? '');
  const PA = window.PA = {};
  const state = {reviews:null,reviewPromise:null,reviewError:'',predictions:null,results:null,verifyPromise:null,verifyError:'',scope:'week',date:'',going:'',research:{venue:'',surface:'',distance:'',trackCondition:'',grade:'',year:'',month:'',lapClass:''},lapId:'',verifyMode:'dated',researchLimit:20};
  const mint='#79edc9', gold='#efd18b', violet='#b6a1ff';
  const num = (v,d=1) => Number.isFinite(v)?v.toFixed(d):'—';
  const pct = (v,n) => n?num(100*v/n)+'%':'—';
  const median = values => {const s=[...values].sort((a,b)=>a-b),i=Math.floor(s.length/2);return s.length?(s.length%2?s[i]:(s[i-1]+s[i])/2):null;};
  const hero = (eyebrow,title,sub) => `<div class="pa-hero"><div class="pa-eyebrow">${E(eyebrow)}</div><h2>${E(title)}</h2><p class="pa-muted">${E(sub)}</p></div>`;
  const panel = (title,body) => `<section class="pa-panel"><h3>${title}</h3>${body}</section>`;
  const note = text => `<div class="pa-note">${E(text)}</div>`;
  const btn = (label,action,secondary=false,disabled=false) => `<button type="button" class="pa-btn${secondary?' secondary':''}" onclick="${E(action)}" ${disabled?'disabled':''}>${label}</button>`;
  const empty = text => `<div class="pa-empty">${E(text)}</div>`;
  const stat = (label,value,unit='') => `<div class="pa-stat">${E(label)}<b>${E(value)}<small>${E(unit)}</small></b></div>`;
  const dateKey = publicDateKey;
  const ref = r => r.raceRef || {};
  function raceIdentity(p){const r=p.raceRef||{},s=p.raceSnapshot||{};return r.dayId&&r.venue&&r.raceNumber?[r.dayId,r.venue,r.raceNumber].join('|'):p.raceId||p.raceKey||p._docId;}
  function resultIdentity(r){return [r.dayId,r.venueName,r.raceNumber].join('|');}
  const reviewIdentity = r => r.raceId || r._docId;
  const reviewTitle = r => {const x=ref(r);return `${x.date||''} ${x.venue||''} ${x.raceNumber||x.r||''}R ${x.raceName||x.name||''}`;};
  async function readCollection(name){
    if(!(await waitForFirebase(5000)))throw Error('接続できませんでした。時間を置いて再試行してください。');
    const {collection,query,orderBy,limit,startAfter,getDocs}=window._fbFns;
    const items=[];let cursor=null;
    do {
      const constraints=[orderBy('__name__'),limit(100)];if(cursor)constraints.push(startAfter(cursor));
      const snap=await getDocs(query(collection(window._fbDb,name),...constraints));
      items.push(...snap.docs.map(d=>({...d.data(),_docId:d.id})));
      if(snap.docs.length<100)break;
      cursor=snap.docs[snap.docs.length-1];
      await new Promise(r=>setTimeout(r,0));
    }while(cursor);
    return items;
  }
  PA.loadReviews = async () => {
    if(state.reviews)return;
    if(state.reviewPromise)return state.reviewPromise;
    state.reviewError='';
    state.reviewPromise=(async()=>{try{state.reviews=await readCollection('raceReviews');wholeReviewRankingRecords=state.reviews;wholeReviewRankingLoaded=true;}catch(e){state.reviewError=e.message;}finally{state.reviewPromise=null;refreshCurrent();}})();
    refreshCurrent();return state.reviewPromise;
  };
  PA.loadVerification = async () => {
    if(state.verifyPromise)return state.verifyPromise;
    state.verifyError='';
    state.verifyPromise=(async()=>{try{const [ps,rs]=await Promise.all([readCollection('predictions'),readCollection('raceResults')]);state.predictions=ps;state.results=rs;}catch(e){state.verifyError=e.message;}finally{state.verifyPromise=null;if(currentView==='publicResults')renderPublicResults();}})();
    if(currentView==='publicResults')renderPublicResults();return state.verifyPromise;
  };
  function loadReviewsUI(){return `<p class="pa-muted">保存された回顧から、展開とラップの比較材料を読み込みます。</p>${btn(state.reviewPromise?'読み込み中…':'回顧データを読み込む','PA.loadReviews()',false,!!state.reviewPromise)}${state.reviewError?`<p role="alert" class="pa-inline-error">${E(state.reviewError)}</p>`:''}`;}
  function refreshCurrent(){if(currentView==='publicPredict')renderPublicPredict();if(currentView==='publicResearch')renderResearch();}
  PA.researchFilter=(k,v)=>{if(Object.hasOwn(state.research,k))state.research[k]=v;if(k==='lapClass')state.research.grade='';if(k==='grade')state.research.lapClass='';state.lapId='';state.researchLimit=20;renderResearch();};
  PA.resetResearch=()=>{Object.keys(state.research).forEach(k=>state.research[k]='');state.lapId='';state.researchLimit=20;renderResearch();};
  PA.pickLap=id=>{state.lapId=id;renderResearch();};
  PA.moreResearch=()=>{state.researchLimit+=20;const y=scrollY;renderResearch();window.scrollTo(0,y);};
  function matchingReviews(filters=state.research,before=''){
    return (state.reviews||[]).filter(r=>{
      const x=ref(r),d=dateKey(x.date),grade=publicReviewClass(r);
      if(before&&(!d||d>=before))return false;
      return Object.entries(filters).every(([k,v])=>k==='lapClass'?LM.matchesClass(x.grade,v):!v||String(k==='grade'?grade:k==='year'?d.slice(0,4):k==='month'?Number(d.slice(4,6)):x[k]??'')===String(v));
    });
  }
  function optionSelect(key,label,values,current,action){return `<label>${E(label)}<select aria-label="${E(label)}" onchange="${action}"><option value="">すべて</option>${values.map(v=>`<option value="${E(v)}" ${String(current)===String(v)?'selected':''}>${E(v)}</option>`).join('')}</select></label>`;}
  function researchFilters(){
    const rows=state.reviews||[],keys=[['venue','競馬場'],['surface','芝・ダート'],['distance','距離（m）'],['trackCondition','馬場状態'],['grade','クラス個別'],['lapClass','クラス群'],['year','年'],['month','月']];
    return `<div class="pa-filters">${keys.map(([k,l])=>{if(k==='lapClass')return `<label>クラス群<select aria-label="研究のクラス群" onchange="PA.researchFilter('lapClass',this.value)"><option value="">全クラス</option>${LM.classOptions.filter(([v])=>['un','winplus','graded'].includes(v)).map(([v,l])=>`<option value="${v}" ${state.research.lapClass===v?'selected':''}>${E(l)}</option>`).join('')}</select></label>`;const vs=[...new Set(rows.map(r=>k==='grade'?publicReviewClass(r):k==='year'?dateKey(ref(r).date).slice(0,4):k==='month'?Number(dateKey(ref(r).date).slice(4,6)):ref(r)[k]).filter(Boolean))].sort((a,b)=>k==='distance'||k==='month'?a-b:String(a).localeCompare(String(b),'ja'));return optionSelect(k,l,vs,state.research[k],`PA.researchFilter('${k}',this.value)`);}).join('')}</div>${btn('条件をリセット','PA.resetResearch()',true)}`;
  }
  function bars(groups){return groups.map(g=>`<div class="pa-bar"><span>${E(g.label)}</span><div class="pa-bar-track"><div class="pa-bar-fill" style="width:${g.n?Math.min(100,100*g.hit/g.n):0}%"></div></div><small>${pct(g.hit,g.n)} · ${g.hit}/${g.n}</small></div>`).join('');}
  function eventCards(rows){
    return `<div class="pa-grid">${SIMPLE_REVIEW_FIELDS.slice(0,3).map(f=>{
      const known=rows.filter(r=>simpleReviewLabels(f,simpleReviewEvents(r)).length),counts=new Map();
      for(const r of known)for(const v of simpleReviewLabels(f,simpleReviewEvents(r)))counts.set(v,(counts.get(v)||0)+1);
      const groups=[...counts].sort((a,b)=>b[1]-a[1]).map(([v,n])=>({label:f.key==='topFinishFrame'?({inner:'内枠中心',outer:'外枠中心',balanced:'内外混在'}[v]||f.options[v]):f.options[v],hit:n,n:known.length}));
      return panel(E(f.label),groups.length?bars(groups)+`<p class="pa-muted">判定済み ${known.length}件／不明・未記録 ${rows.length-known.length}件${f.multiple?' · 複数分類のため合計は100%を超える場合があります':''}</p>`:empty('この条件では分類データがありません。'));
    }).join('')}</div>${note('回顧に記録されたレースの傾向です。上位馬の枠の分類は、枠別の出走頭数を分母にした好走率とは異なります。')}`;
  }
  // Extract candidates from the existing prose; never persist or replace the original review.
  function parseLap(r){
    const text=String(r.review||''),m=text.match(/ラップ(?:タイム)?(?:は|[:：])?\s*([0-9]+\.[0-9]+(?:\s*[-－―–→,、]\s*[0-9]+\.[0-9]+){2,})/);
    if(!m)return null;
    const laps=(m[1].match(/\d+\.\d+/g)||[]).map(Number),distance=Number(ref(r).distance);
    if(!distance||distance%100||laps.length!==Math.ceil(distance/200)||laps.some(x=>!Number.isFinite(x)||x<4||x>35))return null;
    const first=distance%200||200,segments=laps.map((_,i)=>i?200:first);
    const total=laps.reduce((a,b)=>a+b,0),time=text.match(/(\d+)分(\d{1,2})秒(\d)?/);
    const winnerTime=time?Number(time[1])*60+Number(time[2])+(Number(time[3])||0)/10:null;
    if(winnerTime!=null&&Math.abs(total-winnerTime)>1.0)return null;
    const front=first===200&&distance>=1200?laps.slice(0,3).reduce((a,b)=>a+b,0):null;
    const back=distance>=1200?laps.slice(-3).reduce((a,b)=>a+b,0):null;
    return {record:r,laps,segments,distance,total,front,back};
  }
  const lapCache=new WeakMap();
  function lapOf(r){if(!lapCache.has(r))lapCache.set(r,parseLap(r));return lapCache.get(r);}
  function cohortOf(chosen,rows){const x=ref(chosen.record),day=dateKey(x.date);return rows.map(lapOf).filter(Boolean).filter(l=>reviewIdentity(l.record)!==reviewIdentity(chosen.record)&&dateKey(ref(l.record).date)<day&&['venue','surface','distance','trackCondition'].every(k=>String(ref(l.record)[k])===String(x[k])));}
  function lapChart(chosen,cohort){
    const W=700,H=290,L=49,R=20,T=24,B=40,series=[chosen,...cohort];
    const vals=series.flatMap(l=>l.laps.map((v,i)=>v*200/l.segments[i]));const lo=Math.floor(Math.min(...vals)*2)/2-.3,hi=Math.ceil(Math.max(...vals)*2)/2+.3;
    const x=i=>L+i*(W-L-R)/Math.max(1,chosen.laps.length-1),y=v=>T+(v-lo)*(H-T-B)/(hi-lo);
    const poly=l=>l.laps.map((v,i)=>`${x(i)},${y(v*200/l.segments[i])}`).join(' ');
    const base=cohort.length?chosen.laps.map((_,i)=>median(cohort.map(l=>l.laps[i]*200/l.segments[i]))):null;
    let grid='';for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;grid+=`<line class="pa-tick" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${num(v)}</text>`;}
    let dist=0;const ticks=chosen.segments.map((s,i)=>{dist+=s;return `<text x="${x(i)}" y="${H-12}" text-anchor="middle">${dist}</text>`;}).join('');
    return `<div class="pa-chart-wrap"><svg class="pa-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="対象レースと同条件の過去ラップ比較。下ほど速い。縦軸は200m換算秒、横軸は通過距離メートル"><text x="${L}" y="13">200m換算・秒 / 下ほど速い</text>${grid}${cohort.map(l=>`<polyline points="${poly(l)}" fill="none" stroke="${violet}" stroke-opacity=".18" stroke-width="1.5"/>`).join('')}${base?`<polyline points="${base.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${violet}" stroke-width="2.5" stroke-dasharray="6 5"/>`:''}<polyline points="${poly(chosen)}" fill="none" stroke="${mint}" stroke-width="3"/>${chosen.laps.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v*200/chosen.segments[i])}" r="4" fill="${mint}"><title>${chosen.segments.slice(0,i+1).reduce((a,b)=>a+b,0)}m：${v}秒 / 区間${chosen.segments[i]}m</title></circle>`).join('')}${ticks}</svg></div><div class="pa-legend"><span><i style="background:${mint}"></i>対象レース</span><span><i style="background:${violet}"></i>同条件・過去${cohort.length}件の中央値</span></div>`;
  }
  function scatter(laps){
    const valid=laps.filter(l=>l.front!=null&&l.back!=null);const groups=new Map();for(const l of valid){const x=ref(l.record),k=[x.venue,x.surface,x.distance,x.trackCondition].join('|');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(l);}
    // Each scatter compares one course/distance/going, never raw times across different courses.
    const group=[...groups.values()].sort((a,b)=>b.length-a.length)[0]||[];if(group.length<2)return empty('同じ競馬場・距離・馬場で比較できる前後半ラップが2件以上になると表示します。');
    const f=group.map(l=>l.front),b=group.map(l=>l.back),minF=Math.min(...f)-.5,maxF=Math.max(...f)+.5,minB=Math.min(...b)-.5,maxB=Math.max(...b)+.5,W=650,H=290,L=60,T=25;
    const x=v=>L+(v-minF)*(W-L-20)/(maxF-minF),y=v=>T+(v-minB)*(H-T-45)/(maxB-minB);
    let grid='';for(let i=0;i<5;i++){const fv=minF+(maxF-minF)*i/4,bv=minB+(maxB-minB)*i/4;grid+=`<line class="pa-tick" x1="${x(fv)}" x2="${x(fv)}" y1="${T}" y2="${H-45}"/><line class="pa-tick" x1="${L}" x2="${W-20}" y1="${y(bv)}" y2="${y(bv)}"/><text x="${x(fv)}" y="${H-25}" text-anchor="middle">${num(fv)}</text><text x="${L-8}" y="${y(bv)+3}" text-anchor="end">${num(bv)}</text>`;}
    const r=ref(group[0].record);return `<p class="pa-muted">${E(r.venue)} ${E(r.surface)}${E(r.distance)}m・${E(r.trackCondition)}／${group.length}件。左ほど前半が速く、下ほど後半が速い。同条件の記述比較です。</p><div class="pa-chart-wrap"><svg class="pa-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="同条件の前半600mと後半600mの散布図">${grid}${group.map(l=>`<circle cx="${x(l.front)}" cy="${y(l.back)}" r="6" fill="${mint}" fill-opacity=".65" stroke="${mint}"><title>${E(reviewTitle(l.record))} 前半${num(l.front)}秒・後半${num(l.back)}秒</title></circle>`).join('')}<text x="${W/2}" y="${H-3}" text-anchor="middle">前半600m（秒）</text><text x="${L}" y="13">後半600m（秒）</text></svg></div>`;
  }
  function renderResearch(){
    const el=document.getElementById('publicResearchMain');if(!el)return;
    let body=hero('COURSE & LAP LAB','条件・ラップ研究','展開を分解して、レースの中身を比較する。');
    if(!state.reviews){el.innerHTML=`<div class="pa">${body}${panel('回顧から分析を始める',loadReviewsUI())}</div>`;return;}
    const rows=matchingReviews(),laps=rows.map(lapOf).filter(Boolean).sort((a,b)=>dateKey(ref(b.record).date).localeCompare(dateKey(ref(a.record).date))),chosen=laps.find(l=>reviewIdentity(l.record)===state.lapId)||laps[0];
    const cohort=chosen?cohortOf(chosen,rows):[];
    body+=panel('比較する条件',researchFilters())+`<div class="pa-stats">${stat('条件に一致する回顧',rows.length,'レース')}${stat('実数ラップ抽出候補',laps.length,'レース')}${stat('展開が判定済み',rows.filter(r=>['high','middle','slow'].includes(r.events?.pace)).length,'レース')}</div>`+eventCards(rows);
    if(chosen){const options=laps.map(l=>`<option value="${E(reviewIdentity(l.record))}" ${l===chosen?'selected':''}>${E(reviewTitle(l.record))}</option>`).join('');
      body+=panel('区間ラップを比較',`<label class="pa-muted">対象レース<select class="pa-select" aria-label="ラップ比較の対象レース" onchange="PA.pickLap(this.value)">${options}</select></label>${lapChart(chosen,cohort)}<div class="pa-stats">${stat('走破ラップ合計',num(chosen.total),'秒')}${stat('前半600m',num(chosen.front),'秒')}${stat('後半600m',num(chosen.back),'秒')}</div>${note(`本文からの自動抽出候補です。元資料との照合は未実施。比較対象は同競馬場・芝ダート・距離・馬場状態かつ対象日より前の${cohort.length}件（クラス混在）。件数が少ない場合は標準値と断定しません。100m区間は200m換算して描画します。レースラップは各馬自身のラップではありません。`)}<details><summary>元の回顧と区間値を見る</summary><p class="pa-muted">${E(chosen.record.review)}</p><div class="pa-scroll"><table class="pa-table"><thead><tr><th>区間</th><th>距離</th><th>秒</th></tr></thead><tbody>${chosen.laps.map((v,i)=>`<tr><td>${i+1}</td><td>${chosen.segments[i]}m</td><td>${num(v)}</td></tr>`).join('')}</tbody></table></div></details>`);
    }else body+=panel('区間ラップを比較',empty('この条件では、距離・区間数を確認できるラップ列が見つかりません。条件を広げてください。'));
    body+=panel('前半の負荷 × 後半の速さ',scatter(laps))+panel('条件に一致する回顧',rows.length?rows.slice(0,state.researchLimit).map(r=>`<details style="padding:10px 0;border-top:1px solid var(--pa-line)"><summary>${E(reviewTitle(r))} <span class="pa-tag">${E(publicReviewClass(r))}</span></summary><p class="pa-muted">${E(r.review)}</p><p class="pa-muted">${E(r.analysis)}</p></details>`).join('')+(rows.length>state.researchLimit?btn('さらに20件表示','PA.moreResearch()',true):''):empty('条件に一致する回顧がありません。'));
    el.innerHTML=`<div class="pa">${body}</div>`;
  }
  let radarSequence=0;
  publicRadar = h => {
    const gradientId="paRadarGlow"+(++radarSequence);
    const keys=Object.keys(publicLabels),short=['総合','競馬場','距離','馬場','調子','ラップ'],C=150,R=91,xy=(i,v)=>{const a=-Math.PI/2+i*Math.PI*2/keys.length;return [C+Math.cos(a)*R*v/6,C+Math.sin(a)*R*v/6];},points=v=>keys.map((_,i)=>xy(i,v).join(',')).join(' ');
    const vals=keys.map(k=>h.factors?.[k]!=null&&Number.isFinite(Number(h.factors[k]))?Math.max(0,Math.min(6,Number(h.factors[k]))):null),poly=vals.map((v,i)=>xy(i,v??0).join(',')).join(' ');
    return `<svg class="pa-radar" viewBox="0 0 300 300" role="img" aria-label="${E(h.name)}の6項目評価。各軸0から6、欠測は点線表示"><defs><radialGradient id="${gradientId}"><stop stop-color="#79edc9" stop-opacity=".32"/><stop offset="1" stop-color="#79edc9" stop-opacity=".04"/></radialGradient></defs><circle cx="150" cy="150" r="110" fill="url(#${gradientId})"/>${[1,2,3,4,5,6].map(v=>`<polygon points="${points(v)}" fill="none" stroke="#9bbed4" stroke-opacity="${v===6?.3:.12}" stroke-width="${v===6?1.4:1}"/>`).join('')}${keys.map((_,i)=>{const [x,y]=xy(i,6);return `<line x1="150" y1="150" x2="${x}" y2="${y}" stroke="#9bbed4" stroke-opacity=".15"/>`;}).join('')}<polygon data-score points="${poly}" fill="#79edc92b" stroke="${mint}" stroke-width="2.4" ${vals.includes(null)?'stroke-dasharray="5 3"':''}/>${vals.map((v,i)=>{if(v==null)return '';const [x,y]=xy(i,v);return `<circle cx="${x}" cy="${y}" r="4" fill="${mint}" stroke="#173c3a" stroke-width="2"/>`;}).join('')}${keys.map((k,i)=>{const [x,y]=xy(i,8);return `<text x="${x}" y="${y}" fill="#c4d3e3" font-size="11" text-anchor="middle" dominant-baseline="middle">${short[i]}<tspan x="${x}" dy="16" fill="${vals[i]==null?'#8290a4':mint}" font-size="14" font-weight="700">${vals[i]==null?'未評価':num(vals[i])}</tspan></text>`;}).join('')}</svg>`;
  };
  function radarValues(h){return `<div class="pa-axis-values">${Object.keys(publicLabels).map(k=>`<div><small>${E(publicLabels[k])}</small><b>${h.factors[k]==null?'—':num(Number(h.factors[k]))}</b></div>`).join('')}</div>`;}
  function horseFoot(h){
    const strongest=Object.entries(h.factors||{}).filter(([,v])=>v!=null&&Number.isFinite(Number(v))).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${publicLabels[k]} ${num(Number(v))}`).join(' / ');
    return `<div class="pa-horse-foot"><p class="pa-muted">${strongest?'評価の強み：'+E(strongest):'評価履歴が足りないため判断を保留'}</p><div>${['venue','distance','condition','lap'].map(k=>{const stat=h[k+'Stats'];return `<span class="pa-tag${stat?.count>=3?' mint':''}">${E(publicLabels[k])} ${stat?.count||0}走</span>`;}).join('')}</div><details style="margin:10px 0"><summary class="pa-muted">採点根拠と注意点</summary><p class="pa-muted">${E(publicHorseExplanation(h))}</p><p class="pa-muted">${E(h.lapStats?`ラップ照合：過去${h.lapStats.total}走中${h.lapStats.linked}走を同一芝・ダートの回顧と照合。同じラップ型${h.lapStats.matching}走のうちS〜D評価${h.lapStats.count}走を平均。距離・競馬場・クラスは限定しません。`:'ラップの判断材料は読み込み後に表示します。')}</p><p class="pa-muted">基礎点 ${num(h.baseScore,2)} ＋ 既存適性加点 ${num(h.bonusScore,2)}。ラップ独自のボーナスはありません。</p></details>${h.name&&h.known?btn('この馬の過去走を見る',`PA.openHorse(${JSON.stringify(h.name)})`,true):''}</div>`;
  }
  PA.openHorse=name=>jumpToHorse(name);
  PA.setScope=scope=>{state.scope=scope;state.date='';state.scenario='';state.lapClass='auto';publicSelectedRaceKey='';renderPublicPredict();};
  PA.setDate=date=>{state.date=date;publicSelectedRaceKey='';renderPublicPredict();};
  PA.setGoing=value=>{state.going=value;renderPublicPredict();};
  const originalChoose=publicChooseRace;
  publicChooseRace=key=>{state.going='';state.scenario='';originalChoose(key);};
  function allRaceRows(){
    const week=new Set(getThisWeekDates().map(dateKey)),rows=[];
    for(const d of raceDays||[]){const date=dateKey(d.date||d.id);if(state.scope==='week'&&!week.has(date))continue;
      for(const v of d.venues||[])for(const r of v.races||[]){const track=String(r.track||'');rows.push({date,dayId:d.id,venue:v.name,raceNumber:r.r,raceName:r.name,surface:aiExtractSurface(track),distance:Number(aiExtractDistance(track)),trackCondition:r.trackCondition||(/不良|稍重|重|良/.test(track)?aiGetTrackCondition(track):''),track,sourceRace:r});}
    }
    return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.venue.localeCompare(b.venue,'ja')||a.raceNumber-b.raceNumber);
  }
  PA.researchFromRace=()=>{
    const selected=allRaceRows().find(r=>publicRaceKey(r)===publicSelectedRaceKey);if(selected){state.research={venue:selected.venue,surface:selected.surface,distance:String(selected.distance||''),trackCondition:state.going||selected.trackCondition,grade:'',year:'',month:'',lapClass:''};state.lapId='';}
    switchView('publicResearch');
  };

  state.scenario='';state.lapClass='auto';
  PA.setScenario=value=>{state.scenario=['high','middle','slow'].includes(value)?value:'';renderPublicPredict();};
  PA.setLapClass=value=>{state.lapClass=value;renderPublicPredict();};
  let lapContextCache=null;
  function lapContext(selected){
    const choice=LM.resolveClass(state.lapClass,selected.sourceRace?.grade),going=selected.trackCondition||'良';
    const cacheKey=[selected.date,selected.venue,selected.surface,selected.distance,going,choice].join('|');
    if(lapContextCache?.key===cacheKey&&lapContextCache.reviews===state.reviews)return lapContextCache;
    const rows=matchingReviews({venue:selected.venue,surface:selected.surface,distance:String(selected.distance),trackCondition:going},selected.date).filter(r=>LM.matchesClass(ref(r).grade,choice));
    const parsed=rows.map(lapOf).filter(Boolean),profile=LM.meanProfile(parsed);
    return lapContextCache={key:cacheKey,reviews:state.reviews,choice,rows,parsed,profile};
  }
  const fiveFactorRanking=publicRaceRanking;
  publicRaceRanking=selected=>{
    const ranked=fiveFactorRanking(selected),context=lapContext(selected);
    for(const h of ranked){
      const originalBase=scoreWithWeights(h,publicAppliedWeights),bonus=h.customScore==null||originalBase==null?0:h.customScore-originalBase;
      const horse=(horses||[]).find(x=>x.name===h.name);
      h.lapStats=LM.horseAptitude(horse,state.reviews||[],context.profile?.pattern,{surface:selected.surface,before:selected.date,parse:lapOf});
      h.factors.lap=h.lapStats.avg;
      let sum=0,weight=0;for(const k of Object.keys(publicLabels)){const v=h.factors[k],w=Number(publicAppliedWeights[k])||0;if(v==null||!Number.isFinite(Number(v))||w<=0)continue;sum+=Number(v)*w;weight+=w;}
      h.baseScore=weight?sum/weight:null;h.bonusScore=bonus;h.customScore=h.baseScore==null?null:h.baseScore+bonus;
    }
    return ranked.sort((a,b)=>(b.customScore??-Infinity)-(a.customScore??-Infinity)||Number(a.num)-Number(b.num));
  };
  function averageLapChart(profile){
    if(!profile)return '';
    const W=680,H=220,L=42,T=25,B=35,values=profile.laps.map((v,i)=>v*200/profile.segments[i]),lo=Math.min(...values)-.4,hi=Math.max(...values)+.4;
    const x=i=>L+i*(W-L-15)/Math.max(1,values.length-1),y=v=>T+(v-lo)*(H-T-B)/(hi-lo);
    let distance=0;return `<div class="pa-chart-wrap"><svg class="pa-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="指定クラス群の平均ラップ。下ほど速い">${[0,1,2,3].map(i=>{const v=lo+(hi-lo)*i/3;return `<line class="pa-tick" x1="${L}" x2="${W-15}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-5}" y="${y(v)+4}" text-anchor="end">${num(v)}</text>`;}).join('')}<polyline points="${values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${mint}" stroke-width="3"/>${values.map((v,i)=>{distance+=profile.segments[i];return `<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${mint}"><title>${distance}m / 元区間平均${num(profile.laps[i],2)}秒</title></circle><text x="${x(i)}" y="${H-10}" text-anchor="middle">${distance}</text>`;}).join('')}<text x="${L}" y="14">200m換算秒 / 下ほど速い</text></svg></div>`;
  }
  function lapBriefing(records,selected,going){
    const context=lapContext({...selected,trackCondition:going}),profile=context.profile;
    const labels=LM.classOptions.find(([k])=>k===context.choice)?.[1]||context.choice;
    let html=`<div class="pa-filters"><label>平均ラップの比較クラス<select aria-label="平均ラップの比較クラス" onchange="PA.setLapClass(this.value)">${LM.classOptions.map(([k,l])=>`<option value="${k}" ${state.lapClass===k?'selected':''}>${E(l)}</option>`).join('')}</select></label></div><p class="pa-muted">${E(selected.venue)} ${E(selected.surface)}${selected.distance}m・${E(going)}／${E(labels)}／対象日より前の回顧 ${context.rows.length}件。</p>`;
    html+=`<div class="pa-stats">${stat('平均ラップから見た傾向',profile?LM.LABELS[profile.pattern]:'材料不足')}${stat('平均に使えた実数ラップ',profile?.count||0,'レース')}${stat('前後半の差',profile?num(profile.delta,2):'—','秒 / 200m換算')}</div>`;
    html+=note('対象日より前の同競馬場・芝ダート・距離・馬場・指定クラスの区間秒を算術平均。前半と後半を距離の中点で分け、200m換算で後半が0.10秒超遅ければ前傾、逆なら後傾、それ以外は平均型とする暫定基準です。中点をまたぐ区間は一定速度を仮定して按分します。今回の確定的な展開予測ではありません。');
    if(profile)html+=`<details style="margin-top:12px"><summary>平均ラップと計算根拠を見る</summary>${averageLapChart(profile)}<p class="pa-muted">前半 ${num(profile.front200,2)}秒 / 後半 ${num(profile.back200,2)}秒（200m換算）。元回顧からの抽出候補です。ラップ適性は、この平均から求めた型に該当する各馬の過去評価の平均です。</p></details>`;
    else html+=note('実数ラップが不足しているため、ラップ適性は未評価です。0点として計算せず、重みの分母からも除きます。クラス条件を広げると比較材料が増える場合があります。');
    html+=`<details style="margin-top:12px"><summary>自分の展開想定をメモする</summary><label class="pa-muted">今回のペース<select class="pa-select" aria-label="今回の展開想定" onchange="PA.setScenario(this.value)"><option value="">まだ決めない</option>${[['high','ハイペース'],['middle','ミドルペース'],['slow','スローペース']].map(([k,l])=>`<option value="${k}" ${state.scenario===k?'selected':''}>${l}想定</option>`).join('')}</select></label><p class="pa-muted">ペースの高低と前傾・後傾は別の指標です。このメモでは平均ラップ型や点数は変更しません。</p></details>`;
    html+=`<div class="pa-toolbar">${btn('条件を詳しく研究','PA.researchFromRace()',true)}</div><details style="margin-top:12px"><summary>回顧に記録された展開・枠の内訳</summary>${eventCards(context.rows)}</details>`;
    return html;
  }
  renderPublicPredict=()=>{
    const el=document.getElementById('publicPredictMain');if(!el)return;
    const rows=allRaceRows(),dates=[...new Set(rows.map(r=>r.date))];if(!dates.includes(state.date))state.date=dates[0]||'';
    const visible=rows.filter(r=>r.date===state.date),selected=visible.find(r=>publicRaceKey(r)===publicSelectedRaceKey)||null;
    let body=hero('RACE ASSISTANT','予想の根拠を、一頭ずつ。','条件の傾向、6つの評価、過去の裏付けを並べて考える。');
    body+=panel('レースを選ぶ',`<div class="pa-toolbar">${btn('今週のレース',"PA.setScope('week')",state.scope!=='week')}${btn('過去開催で振り返る',"PA.setScope('archive')",state.scope!=='archive')}</div>${visible.length?`<div class="pa-filters"><label>開催日<select class="pa-select" onchange="PA.setDate(this.value)">${dates.map(d=>`<option value="${E(d)}" ${state.date===d?'selected':''}>${d.slice(0,4)}/${d.slice(4,6)}/${d.slice(6,8)}</option>`).join('')}</select></label><label style="grid-column:span 2">競馬場・レース<select class="pa-select" aria-label="予想するレース" onchange="publicChooseRace(this.value)"><option value="">レースを選択してください</option>${visible.map(r=>`<option value="${E(publicRaceKey(r))}" ${selected===r?'selected':''}>${E(r.venue)} ${E(r.raceNumber)}R ${E(r.raceName)} · ${E(r.surface)}${E(r.distance)}m</option>`).join('')}</select></label></div>`:empty('今週の開催データがまだありません。「過去開催で振り返る」から保存済みのレースを確認できます。')}`);
    if(!selected){el.innerHTML=`<div class="pa">${body}${panel('あなたの予想に、比較できる根拠を。',`<div class="pa-stats">${stat('評価の視点','6','項目')}${stat('比較するもの','展開','と適性')}${stat('判断の材料','実績','と件数')}</div><p class="pa-muted">レースを選ぶと六角形の評価カードと条件傾向を表示します。過去の傾向を調べるなら「条件・ラップ研究」へ。</p>${btn('条件・ラップ研究を開く',"switchView('publicResearch')",true)}`)}</div>`;return;}
    const going=state.going||selected.trackCondition||'良',working={...selected,trackCondition:going},ranked=publicRaceRanking(working),scored=ranked.filter(h=>h.customScore!=null),gap=scored.length>1?scored[0].customScore-scored[1].customScore:null;
    body+=panel(`${E(selected.venue)} ${E(selected.raceNumber)}R · ${E(selected.raceName)}`,`<div><span class="pa-tag mint">${E(selected.surface)} ${E(selected.distance)}m</span><span class="pa-tag">${E(publicReviewClass({raceRef:{venue:selected.venue,grade:selected.sourceRace.grade}}))}</span><span class="pa-tag">${ranked.length}頭</span></div><div class="pa-toolbar"><label class="pa-muted">想定する馬場 <select class="pa-select" style="width:auto" aria-label="想定する馬場" onchange="PA.setGoing(this.value)">${['良','稍重','重','不良'].map(g=>`<option ${g===going?'selected':''}>${g}</option>`).join('')}</select></label><span class="pa-muted">${!selected.trackCondition&&!state.going?'馬場未登録のため「良」を仮設定。変更できます。':'馬場適性の評価に反映します。'}</span></div>${state.scope==='archive'?note('過去開催の参考計算です。現在の馬の履歴を使うため、当時の発走前予想の再現・精度検証には使えません。保存済みスコアの検証は「予想の検証」で確認できます。'):''}<div class="pa-stats">${stat('評価できた馬',scored.length,`/ ${ranked.length}頭`)}${stat('トップスコア',scored.length?num(scored[0].customScore,2):'—','点')}${stat('1位と2位の点差',num(gap,2),'点')}</div>`);
    if(state.reviews){const filters={venue:selected.venue,surface:selected.surface,distance:String(selected.distance),trackCondition:going},records=matchingReviews(filters,selected.date);body+=panel('今回の条件・ラップの判断材料',lapBriefing(records,selected,going));}else{body+=panel('同条件のラップ・展開を確認',loadReviewsUI());if(!state.reviewPromise&&!state.reviewError)Promise.resolve().then(()=>PA.loadReviews());}
    body+=panel('6つの視点で比較する',`<p class="pa-muted">六角形は各項目0〜6。ラップ適性は同じラップ型の過去S〜D評価の平均。最終スコアは適性加点を含むため6点を超えることがあります。未評価は0点と区別して表示します。</p><div class="pa-podium">${ranked.slice(0,3).map((h,i)=>`<article class="pa-horse"><div class="pa-rank">SCORE RANK / 0${i+1}</div><h3>${E(h.num)}番 ${E(h.name)}</h3><div class="pa-kpi">${h.customScore==null?'—':num(h.customScore,2)} <small>評価スコア</small></div>${publicRadar(h)}${radarValues(h)}${horseFoot(h)}</article>`).join('')}</div>`);
    body+=`<details class="pa-panel"><summary>全頭の評価を一覧で見る（${ranked.length}頭）</summary><div class="pa-list">${ranked.map((h,i)=>`<details><summary><span class="pa-tag${i<3?' gold':''}">${i+1}位</span><strong>${E(h.num)}番 ${E(h.name)}</strong><span class="pa-kpi" style="font-size:20px">${h.customScore==null?'—':num(h.customScore,2)}</span></summary><div class="pa-horse-body">${publicRadar(h)}<div>${radarValues(h)}${horseFoot(h)}</div></div></details>`).join('')}</div></details>`;
    body+=`<details class="pa-panel pa-weight"><summary>重視する項目を調整する</summary><p class="pa-muted">初期値は各3。重みを変更後に再計算してください。</p>${Object.entries(publicLabels).map(([k,l])=>`<label>${E(l)} <b id="pa-w-${k}">${publicDraftWeights[k]}</b><input aria-label="${E(l)}の重み" type="range" min="0" max="6" step="1" value="${publicDraftWeights[k]}" oninput="publicSetWeight('${k}',this.value);document.getElementById('pa-w-${k}').textContent=this.value"></label>`).join('')}${btn('この重みで再計算','publicRecalculate()')}</details>`;
    el.innerHTML=`<div class="pa">${body}</div>`;
  };
  function configKey(p){return JSON.stringify([snapshotKeys.map(k=>Number(p.weights?.[k])||0),p.conditionMode||'',!!p.surfaceFilterEnabled,p.engineVersion||'',p.scoringVersion||'']);}
  function standardConfig(p){return snapshotKeys.every(k=>Number(p.weights?.[k])===3)&&p.conditionMode==='good'&&!p.surfaceFilterEnabled;}
  state.verifyConfig='';
  PA.verifySetting=(key,value)=>{if(key==='config')state.verifyConfig=value;if(key==='mode')state.verifyMode=value;renderPublicResults();};
  function verifyData(){
    const ps=state.predictions||[],rs=state.results||[],byid=new Map(rs.map(r=>[r.raceId,r])),byref=new Map(rs.map(r=>[resultIdentity(r),r]));
    let after=0,unknown=0,unmatched=0,incomplete=0,duplicates=0;const seen=new Set(),records=[];
    const configs=[...new Map(ps.map(p=>[configKey(p),p])).entries()];if(!configs.some(([k])=>k===state.verifyConfig))state.verifyConfig=configs.find(([,p])=>standardConfig(p))?.[0]||configs[0]?.[0]||'';
    for(const p of [...ps].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')))){
      const raceDate=dateKey(p.raceSnapshot?.date),created=new Date(p.createdAt),stamp=Number.isFinite(created.getTime())?created.toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}).replace(/-/g,''):'';
      const isAfter=!!(raceDate&&stamp&&stamp>raceDate);if(isAfter)after++;if(!raceDate||!stamp)unknown++;
      if(state.verifyMode==='dated'&&(!raceDate||!stamp||isAfter))continue;
      if(state.verifyMode==='retro'&&!isAfter)continue;
      if(configKey(p)!==state.verifyConfig)continue;
      const identity=raceIdentity(p);if(seen.has(identity)){duplicates++;continue;}seen.add(identity);
      const r=byid.get(p.raceId)||byref.get(identity);if(!r){unmatched++;continue;}
      const hs=r.result?.horses||[],valid=hs.length&&hs.every(h=>['取消','中止'].includes(h.status)||(Number(h.finish)>0&&Number.isFinite(Number(h.finish))));
      if(r.resultStatus!=='complete'||!valid){incomplete++;continue;}
      const rm=new Map(hs.map(h=>[String(h.num),h])),horses=(p.horses||[]).map(h=>{const result=rm.get(String(h.num));return {...h,finish:result?.finish,resultStatus:result?.status||'',excluded:result?.status==='取消'};}).filter(h=>!h.excluded&&h.score!=null&&Number.isFinite(Number(h.score))&&(h.resultStatus==='中止'||Number(h.finish)>0));
      // Preserve original #1; do not substitute another horse if its result is absent/cancelled.
      const top=horses.find(h=>Number(h.rank)===1),savedRanked=(p.horses||[]).filter(h=>h.score!=null&&Number.isFinite(Number(h.score))&&Number(h.rank)>0).sort((a,b)=>a.rank-b.rank);
      records.push({p,horses,top,gap:savedRanked.length>1?Number(savedRanked[0].score)-Number(savedRanked[1].score):null});
    }
    return {configs,records,after,unknown,unmatched,incomplete,duplicates};
  }
  function wilson(hit,n){if(!n)return [0,0];const p=hit/n,z=1.96,den=1+z*z/n,c=(p+z*z/(2*n))/den,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;return [Math.max(0,c-h),Math.min(1,c+h)];}
  function rateChart(groups,label){
    const W=640,L=95,R=80,T=24,row=48,H=T+groups.length*row+30,barW=W-L-R;
    const grid=[0,25,50,75,100].map(v=>`<line class="pa-tick" x1="${L+barW*v/100}" x2="${L+barW*v/100}" y1="${T-10}" y2="${H-25}"/><text x="${L+barW*v/100}" y="${H-6}" text-anchor="middle">${v}%</text>`).join('');
    return `<div class="pa-chart-wrap"><svg class="pa-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${E(label)}。横棒は3着内率、線は95パーセントWilson区間">${grid}${groups.map((g,i)=>{const y=T+i*row,[lo,hi]=wilson(g.hit,g.n),v=g.n?g.hit/g.n:0;return `<text x="${L-10}" y="${y+17}" text-anchor="end">${E(g.label)}</text><rect x="${L}" y="${y+6}" width="${barW*v}" height="18" rx="4" fill="${mint}" fill-opacity=".6"/>${g.n?`<line x1="${L+barW*lo}" x2="${L+barW*hi}" y1="${y+15}" y2="${y+15}" stroke="${gold}" stroke-width="2"/><line x1="${L+barW*lo}" x2="${L+barW*lo}" y1="${y+10}" y2="${y+20}" stroke="${gold}"/><line x1="${L+barW*hi}" x2="${L+barW*hi}" y1="${y+10}" y2="${y+20}" stroke="${gold}"/>`:''}<text x="${W-R+8}" y="${y+14}">${pct(g.hit,g.n)}</text><text x="${W-R+8}" y="${y+29}">${g.hit}/${g.n}件</text>`;}).join('')}</svg></div>`;
  }
  const originalResults=renderPublicResults,originalHistory=renderPublicHistory;
  function resultTabs(active){return `<div class="pa pa-subnav"><div class="pa-toolbar">${btn('スコア・成績を検証',"switchView('publicResults')",active!=='results')}${btn('保存済み予想を見る',"switchView('publicHistory')",active!=='history')}</div></div>`;}
  function verificationPanel(){
    let body=hero('PREDICTION AUDIT','スコアを、実績で確かめる。','当時保存した評価と結果を比較。点数の高さが、どの程度好走につながったか。');
    if(!state.predictions)return `<div class="pa">${body}${panel('保存済みスコアを検証',`<p class="pa-muted">予想と結果を読み込みます。以下の条件検索とは独立した分析です。</p>${btn(state.verifyPromise?'読み込み中…':'スコア検証データを読み込む','PA.loadVerification()',false,!!state.verifyPromise)}${state.verifyError?`<p role="alert" class="pa-inline-error">${E(state.verifyError)}</p>`:''}`)}</div>`;
    const data=verifyData(),{records}=data,hs=records.flatMap(r=>r.horses),groups=Array.from({length:5},(_,i)=>({label:i===4?'8点以上':`${i*2}〜${i*2+2}点未満`,n:0,hit:0})),ranks=['1位','2位','3位','4〜5位','6位以下'].map(label=>({label,n:0,hit:0})),gaps=['0〜0.5未満','0.5〜1未満','1〜2未満','2点以上'].map(label=>({label,n:0,hit:0}));
    for(const h of hs){const idx=Math.max(0,Math.min(4,Math.floor(Number(h.score)/2))),g=groups[idx];g.n++;if(h.finish!=null&&Number(h.finish)<=3)g.hit++;const rank=Number(h.rank);if(rank>0){const x=ranks[rank<=3?rank-1:rank<=5?3:4];x.n++;if(h.finish!=null&&Number(h.finish)<=3)x.hit++;}}
    for(const r of records){if(!r.top||r.gap==null||r.gap<0)continue;const g=gaps[r.gap<.5?0:r.gap<1?1:r.gap<2?2:3];g.n++;if(r.top.finish!=null&&Number(r.top.finish)<=3)g.hit++;}
    body+=panel('比較する記録',`<div class="pa-filters"><label>保存タイミング<select aria-label="検証の保存タイミング" onchange="PA.verifySetting('mode',this.value)">${[['dated','開催日以前に保存（発走前未確認）'],['retro','開催日の翌日以降に保存'],['all','すべての保存記録']].map(([k,l])=>`<option value="${k}" ${state.verifyMode===k?'selected':''}>${l}</option>`).join('')}</select></label><label style="grid-column:span 2">同じ計算設定で比較<select aria-label="スコア検証の計算設定" onchange="PA.verifySetting('config',this.value)">${data.configs.map(([k,p])=>`<option value="${E(k)}" ${state.verifyConfig===k?'selected':''}>${standardConfig(p)?'標準設定 · ':''}総合${E(p.weights?.overall)} / 場${E(p.weights?.venue)} / 距離${E(p.weights?.distance)} / 馬場${E(p.weights?.condition)} / 調子${E(p.weights?.form)} · ${E(p.conditionMode)} · 芝ダート除外${p.surfaceFilterEnabled?'あり':'なし'}</option>`).join('')}</select></label></div><div class="pa-stats">${stat('同設定・結果確定の対象',records.length,'レース')}${stat('スコアと着順が揃う',hs.length,'頭')}${stat('全保存記録',state.predictions.length,'件')}</div>${note(`同じレース・同じ設定の複数記録は最初の保存を採用。除外した重複${data.duplicates}件、結果未照合${data.unmatched}件、部分入力等${data.incomplete}件。全記録のうち翌日以降の保存${data.after}件、日付不明${data.unknown}件。取消は分母から除き、中止は不的中に含めます。同日保存は発走前か未確認で、予測精度の証明ではありません。`)}`);
    body+=panel('スコア帯別・3着内率',rateChart(groups,'スコア帯別の3着内率')+note('線は95% Wilson区間の参考表示です。少数例や同一レース内の相関、対象の偏りを考慮し、次走の的中確率としては扱いません。'));
    body+=`<div class="pa-grid">${panel('予想順位別・3着内率',rateChart(ranks,'順位別の3着内率'))}${panel('1位と2位の点差・本命3着内率',rateChart(gaps,'点差別の本命3着内率'))}</div>`;
    return `<div class="pa">${body}</div>`;
  }
  renderPublicResults=()=>{document.getElementById('paVerification')?.remove();originalResults();const el=document.getElementById('publicResultsMain');if(el)el.insertAdjacentHTML('afterbegin',`<div id="paVerification">${resultTabs('results')}${verificationPanel()}<div class="pa">${hero('RESULT SEARCH','条件別の成績を調べる','以下の検索・条件ランキングは、上のスコア検証とは独立して集計します。')}</div></div>`);};
  renderPublicHistory=()=>{originalHistory();const el=document.getElementById('publicHistoryMain');if(el)el.insertAdjacentHTML('afterbegin',resultTabs('history')+'<div class="pa">'+note('ここは保存時点の予想スコア・順位・5項目を表示しています。現在の馬評価では再計算しません。表示する着順は後から保存された結果です。')+'</div>');};
  const originalHorseDetail=renderHorseDetail;
  renderHorseDetail=()=>{
    originalHorseDetail();if(!selectedHorse)return;
    const root=document.getElementById('horseDetailEl');if(!root)return;
    const runs=selectedHorse.races||[],linked=runs.filter(r=>r.raceId),labels=['S','A','B','C','D','F'];
    const groups=labels.map(label=>({label:`${label}評価`,hit:runs.filter(r=>aiNormEval(r.eval)===label).length,n:runs.length}));
    root.insertAdjacentHTML('afterbegin',`<div class="pa">${panel('能力の根拠と、これまでの経験',`<div class="pa-stats">${stat('保存された過去走',runs.length,'走')}${stat('レースIDで照合できる',linked.length,'走')}${stat('評価は記録を確認','回顧','から')}</div><details><summary>過去走の評価内訳を見る</summary>${bars(groups)}</details>${note('過去走とレースの照合はレースIDがある記録から行います。同名レースだけでは自動で紐づけず、負荷別の好走率は表示していません。レース全体の傾向は「条件・ラップ研究」で比較できます。')}${btn('条件・ラップ研究を見る',"switchView('publicResearch')",true)}`)}</div>`);
  };
  const nav=document.querySelector('.nav-tabs'),content=document.querySelector('.content');
  const research=document.createElement('div');research.className='view';research.id='view-publicResearch';research.innerHTML='<div class="public-dashboard" id="publicResearchMain"></div>';content.appendChild(research);
  const newNav=document.createElement('div');newNav.className='nav-tab';newNav.dataset.view='publicResearch';newNav.dataset.publicOnly='true';newNav.setAttribute('onclick',"switchView('publicResearch')");newNav.innerHTML='<span class="tab-icon">〰</span> 条件・ラップ研究';nav.appendChild(newNav);
  const names={home:'ホーム',publicPredict:'予想アシスト',publicResearch:'条件・ラップ研究',horses:'全頭診断',publicResults:'予想の検証'},icons={home:'⌂',publicPredict:'◇',publicResearch:'〰',horses:'♞',publicResults:'▥'};
  for(const key of Object.keys(names)){const tab=nav.querySelector(`[data-view="${key}"]`);if(tab){tab.innerHTML=`<span class="tab-icon">${icons[key]}</span>${names[key]}`;nav.appendChild(tab);}}
  const historyTab=nav.querySelector('[data-view="publicHistory"]');if(historyTab)historyTab.style.setProperty('display','none','important');
  const oldSwitch=switchView;
  switchView=v=>{
    if(v==='publicResearch'){
      currentView=v;document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.id==='view-'+v));document.querySelectorAll('.nav-tab').forEach(el=>el.classList.toggle('active',el.dataset.view===v));renderResearch();updateBreadcrumb();
    }else oldSwitch(v);
    if(v==='publicHistory'){nav.querySelector('[data-view="publicHistory"]')?.classList.remove('active');nav.querySelector('[data-view="publicResults"]')?.classList.add('active');}
  };
  const oldBreadcrumb=updateBreadcrumb;
  updateBreadcrumb=()=>{oldBreadcrumb();if(currentView==='publicResearch'){const el=document.getElementById('breadcrumb');el.innerHTML='<span class="crumb" onclick="switchView(\'home\')">ホーム</span><span class="sep">/</span><span class="current">条件・ラップ研究</span>';}else{const crumb=document.querySelector('#breadcrumb .current');if(crumb&&names[currentView])crumb.textContent=names[currentView];}};
  for(const card of document.querySelectorAll('.home-card[data-public-only]')){
    const onclick=card.getAttribute('onclick')||'';
    if(onclick.includes('publicPredict')){card.querySelector('.card-title').textContent='予想アシスト';card.querySelector('.card-desc').innerHTML='5つの評価と条件傾向から<br>今回の候補を比較。';}
    if(onclick.includes('publicResults')){card.querySelector('.card-title').textContent='予想の検証';card.querySelector('.card-desc').innerHTML='スコア・順位・点差が<br>好走につながったかを確認。';}
    if(onclick.includes('publicHistory')){card.setAttribute('onclick',"switchView('publicResearch')");card.querySelector('.card-title').textContent='条件・ラップ研究';card.querySelector('.card-desc').innerHTML='展開と区間ラップから<br>レースの中身を比較。';}
  }
  const home=document.querySelector('.home-cards');if(home){const wrap=document.createElement('div');wrap.className='pa pa-home';wrap.innerHTML=hero('RACE NOTE / ASSISTANT','その予想に、もうひとつの根拠を。','条件を読む。能力を比べる。結果で確かめる。')+`<div class="pa-toolbar">${btn('今週の予想を始める',"switchView('publicPredict')")}${btn('レースの中身を研究',"switchView('publicResearch')",true)}</div>`;home.before(wrap);}
})();
