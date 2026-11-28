/* Presentation snapshot only. No scoring, persistence or network access. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PredictionShareModel=api;})(globalThis,()=>{
 'use strict';
 const labels={front_loaded:'前傾',back_loaded:'後傾',even:'平均型'};
 const classes={un:'未勝利',winplus:'1勝クラス以上',graded:'重賞（G1〜G3）',new:'新馬のみ','1s':'1勝クラスのみ','2s':'2勝クラスのみ','3s':'3勝クラスのみ',op:'OP・Lのみ',g1:'G1のみ',g2:'G2のみ',g3:'G3のみ',all:'全クラス'};
 const clean=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,''),esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 function wrap(value,width,size){const lines=[];for(const paragraph of clean(value).split('\n')){let line='',used=0;for(const token of paragraph.match(/(?:[0-9]+(?:\.[0-9]+)?(?:[a-zA-Z%]+)?|[\s\S])[、。，）」』】]*/gu)||[]){const step=Array.from(token).reduce((sum,c)=>sum+size*(/[MW@]/.test(c)?1:/[\x20-\x7e]/.test(c)?.62:1),0);if(used+step>width&&line){lines.push(line);line='';used=0;}line+=token;used+=step;}lines.push(line);}return lines;}
 function capture(selection,context){
  if(!selection||!context)return null;
  const p=context.profile||null,distance=number(Number(context.distance)),front=number(p?.front200),back=number(p?.back200);
  const counts=Object.fromEntries(Object.keys(labels).map(k=>[k,Math.max(0,Number(selection.counts?.[k])||0)]));
  return {raceName:clean(context.raceName||'レース名未登録'),date:clean(context.date),venue:clean(context.venue),raceNumber:clean(context.raceNumber),surface:clean(context.surface),distance,going:clean(context.going||'馬場未登録'),classLabel:clean(context.classLabel||classes[context.lapClass]||'比較クラス未確認'),settingsLabel:clean(context.settingsLabel||'標準設定'),createdLabel:clean(context.createdLabel),referenceRaces:Math.max(0,Number(selection.referenceRaces)||0),averageRaces:Math.max(0,Number(p?.count??selection.mainBasis?.count)||0),pattern:labels[selection.mainPattern]?selection.mainPattern:null,counts,front:front!=null&&distance?front*distance/400:null,back:back!=null&&distance?back*distance/400:null,interpolated:!!p?.interpolated,picks:(selection.picks||[]).map(h=>({mark:clean(h.mark),num:clean(h.num),name:clean(h.name),score:number(h.originalScore),reason:clean(h.reason||'評価根拠は未登録です。')})),extras:(selection.extraCandidates||[]).map(h=>({num:clean(h.num),name:clean(h.name),score:number(h.score)}))};
 }
 function svg(card){
  const W=1080,pad=64,width=W-pad*2;let y=86,body='';
  const t=(x,y,text,size=26,color='#dae4eb',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${esc(text)}</text>`;
  const lines=(text,x,y,width,size,color,lineHeight,extra='')=>{const rows=wrap(text,width,size);return {body:rows.map((s,i)=>t(x,y+i*lineHeight,s,size,color,extra)).join(''),height:rows.length*lineHeight};};
  body+=t(pad,y,'MA RACE NOTE  /  RACE PREVIEW',21,'#7de8c5','letter-spacing="2"');y+=49;
  body+=t(pad,y,[card.date,card.venue,card.raceNumber?card.raceNumber+'R':''].filter(Boolean).join('  ·  '),28,'#b4c5d1');y+=64;
  let block=lines(card.raceName,pad,y,width,52,'#f5f0e6',64,'font-weight="700"');body+=block.body;y+=block.height+4;
  block=lines([card.surface+(card.distance?card.distance+'m':''),card.going,card.settingsLabel].filter(Boolean).join('  ／  '),pad,y,width,25,'#b4c5d1',34);body+=block.body;y+=block.height+26;
  body+=`<line x1="${pad}" y1="${y}" x2="1016" y2="${y}" stroke="#354653"/>`;y+=46;
  body+=t(pad,y,'今回の予想',29,'#f5f0e6','font-weight="700"');y+=24;
  for(const pick of card.picks){const name=lines(pick.num+'番 '+pick.name,pad+112,y+44,650,36,'#f5f0e6',44,'font-weight="700"');const reason=lines(pick.reason,pad+112,y+44+name.height+7,width-142,26,'#b9cbd5',37);const height=44+name.height+7+reason.height+15;body+=`<rect x="${pad}" y="${y}" width="${width}" height="${height}" rx="18" fill="#182b36" stroke="#314753"/>`+t(pad+28,y+58,pick.mark,46,pick.mark==='☆'?'#bca8f5':'#efd18b','font-weight="700"')+name.body+t(992,y+40,pick.score==null?'未評価':pick.score.toFixed(2)+'点',24,'#7de8c5','text-anchor="end"')+reason.body;y+=height+16;}
  if(!card.picks.length){body+=t(pad,y+34,'評価できる出走馬がありません',27,'#b9cbd5');y+=80;}
  y+=28;body+=t(pad,y,'この条件のラップ判断材料',29,'#f5f0e6','font-weight="700"');y+=45;
  const lapLines=[card.pattern?labels[card.pattern]+'想定':'ラップ構成は判断材料不足',`${card.venue}・${card.surface}${card.distance||''}m・${card.going} ／ ${card.classLabel}`,`分類済み ${card.referenceRaces}R ／ 平均ラップ ${card.averageRaces}R`,Object.entries(labels).map(([k,v])=>`${v} ${card.counts[k]}R`).join('  ／  ')];
  if(card.front!=null&&card.back!=null)lapLines.push(`平均：前半 ${card.front.toFixed(1)}秒 → 後半 ${card.back.toFixed(1)}秒`);
  for(const [i,line]of lapLines.entries()){block=lines(line,pad,y,width,i===0?32:25,i===0?'#7de8c5':'#b4c5d1',36,i===0?'font-weight="700"':'');body+=block.body;y+=block.height+7;}
  if(card.interpolated){body+=t(pad,y,'距離の前後半で比較（半分にまたがる区間は按分）',21,'#91a8b7');y+=36;}
  y+=10;body+=`<line x1="${pad}" y1="${y}" x2="1016" y2="${y}" stroke="#354653"/>`;y+=40;
  block=lines('印外の紐候補：'+(card.extras.length?card.extras.map(h=>`${h.num}番 ${h.name}${h.score==null?'':'（'+h.score.toFixed(2)+'点）'}`).join(' ／ '):'該当なし'),pad,y,width,23,'#adbdc9',33);body+=block.body;y+=block.height+34;
  block=lines('前傾・後傾は前後半の形。ハイ・スローとは別の分類。',pad,y,width,20,'#849aa9',29);body+=block.body;y+=block.height;
  block=lines('表示時点の評価による参考予想'+(card.createdLabel?' ／ 作成 '+card.createdLabel:''),pad,y,width,18,'#849aa9',27);body+=block.body;y+=block.height+50;
  const height=Math.max(1350,Math.ceil(y));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}" role="img" aria-label="${esc(card.raceName)}の予想共有カード" style="font-family:Arial,'Noto Sans JP','Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif"><defs><linearGradient id="prediction-card-bg" x2="1" y2="1"><stop stop-color="#142a33"/><stop offset="1" stop-color="#0d131d"/></linearGradient></defs><rect width="1080" height="${height}" fill="#0d131d"/><rect x="24" y="24" width="1032" height="${height-48}" rx="28" fill="url(#prediction-card-bg)" stroke="#354653"/>${body}</svg>`;
 }
 return {capture,svg,wrap};
});
