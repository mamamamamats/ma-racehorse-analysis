/* Daily standard selections, using local horses and public JSON only. */
(()=>{
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function svg(card){
  const venues=[...new Set(card.rows.map(r=>r.venue))],colWidth=936/Math.max(1,venues.length),height=Math.max(720,320+Math.max(0,...venues.map(v=>card.rows.filter(r=>r.venue===v).length))*112);
  const t=(x,y,s,size=25,color='#dae4eb')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${esc(s)}</text>`;
  let body=t(64,85,'MA RACE NOTE / DAILY PICKS',23,'#7de8c5')+t(64,148,card.date+' 本命一覧',48,'#f5f0e6')+t(64,194,'標準設定・レース設定の馬場／新馬・未勝利を除く',24,'#a8b9c6');
  venues.forEach((v,i)=>{const x=64+i*colWidth;body+=t(x,252,v,34,'#7de8c5');card.rows.filter(r=>r.venue===v).forEach((r,j)=>{const y=282+j*112;body+=`<rect x="${x}" y="${y}" width="${colWidth-16}" height="100" rx="10" fill="#182b36"/>`+t(x+14,y+29,r.r+'R '+r.name,21);const label=r.pick?'◎ '+r.pick.num+' '+r.pick.name:'評価不足・予想なし';const size=Math.min(28,(colWidth-44)/Math.max(1,Array.from(label).length));body+=t(x+14,y+64,label,size,r.pick?'#efd18b':'#a8b9c6');if(r.warning)body+=t(x+14,y+88,'※評価済み8割以下',18,'#efd18b');});});
  if(!card.rows.length)body+=t(64,300,'対象レースがありません',30);
  body+=t(64,height-32,'現在のデータによる参考予想・登録済み予想は変更しません',20,'#a8b9c6');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}" style="font-family:Arial,'Noto Sans JP',sans-serif"><rect width="1080" height="${height}" fill="#0d131d"/>${body}</svg>`;
 }
 async function open(dayId,trigger){if(!isEditMode)return;const day=raceDays.find(d=>d.id===dayId);if(!day)return;trigger.disabled=true;try{
  await window.SharedPredictionRuntime.ensure({publicOnly:true});const rows=[];const seen=new Set();
  for(const venue of day.venues||[])for(const race of [...(venue.races||[])].sort((a,b)=>Number(a.r)-Number(b.r))){const key=venue.name+'|'+race.r;if(seen.has(key)||!window.dayStandardEligible(race))continue;seen.add(key);const result=window.SharedPredictionRuntime.calculate(day,venue,race,{weights:{overall:3,venue:3,distance:3,condition:3,form:3,lap:3},going:window.SharedPredictionRuntime.goingFor(race),lapClass:'auto',surfaceFilter:false});const scored=result.ranked.filter(h=>Number.isFinite(h.score)).length;const pick=result.selection.picks.find(h=>h.mark==='◎');rows.push({venue:venue.name,r:race.r,name:race.name||'',pick:pick?{num:pick.num,name:pick.name}:null,warning:result.ranked.length>0&&scored*5<=result.ranked.length*4});}
  const card={date:day.date,raceName:'本命一覧',venue:'全開催',raceNumber:'一覧',rows};window.PredictionShare.openCard(card,svg(card),trigger);
 }catch(e){showToast('本命一覧を作成できません：'+e.message,true);}finally{trigger.disabled=false;}}
 window.DailyPredictionShare={open,svg};
})();
