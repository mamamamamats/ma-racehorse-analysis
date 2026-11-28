/* Presentation snapshot only. No scoring, persistence or network access. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./score-display-scale.js'):root.ScoreDisplayScale);if(typeof module==='object'&&module.exports)module.exports=api;else root.PredictionShareModel=api;})(globalThis,(Scale)=>{
 'use strict';
 const labels={front_loaded:'前傾',back_loaded:'後傾',even:'平均型'};
 const classes={un:'未勝利',winplus:'1勝クラス以上',graded:'重賞（G1〜G3）',new:'新馬のみ','1s':'1勝クラスのみ','2s':'2勝クラスのみ','3s':'3勝クラスのみ',op:'OP・Lのみ',g1:'G1のみ',g2:'G2のみ',g3:'G3のみ',all:'全クラス'};
 const clean=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,''),esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 function wrap(value,width,size){const lines=[];for(const paragraph of clean(value).split('\n')){let line='',used=0;for(const token of paragraph.match(/(?:[0-9]+(?:\.[0-9]+)?(?:[a-zA-Z%]+)?|[\s\S])[、。，）」』】]*/gu)||[]){const step=Array.from(token).reduce((sum,c)=>sum+size*(/[MW@]/.test(c)?1:/[\x20-\x7e]/.test(c)?.62:1),0);if(used+step>width&&line){lines.push(line);line='';used=0;}line+=token;used+=step;}lines.push(line);}return lines;}
 function capture(selection,context){
  if(!selection||!context)return null;
  const byNum=new Map((context.scoreRows||[]).map(h=>[String(h.num),h]));
  const p=context.profile||null,distance=number(Number(context.distance)),front=number(p?.front200),back=number(p?.back200);
  const valid=p&&Array.isArray(p.laps)&&Array.isArray(p.segments)&&p.laps.length>=2&&p.laps.length===p.segments.length&&p.laps.every(v=>number(v)!=null&&v>0)&&p.segments.every(v=>number(v)!=null&&v>0)&&Math.abs(p.segments.reduce((a,b)=>a+b,0)-distance)<.01;
  const lapPoints=valid?p.laps.map((v,i)=>({seconds:v*200/p.segments[i],distance:p.segments.slice(0,i+1).reduce((a,b)=>a+b,0)})):[];
  const counts=Object.fromEntries(Object.keys(labels).map(k=>[k,Math.max(0,Number(selection.counts?.[k])||0)]));
  const coverage=Array.isArray(context.scoreRows)?{total:context.scoreRows.length,scored:context.scoreRows.filter(h=>Number.isFinite(h.score)).length}:null;
  return {coverage,scoreMax:Scale.maximum(context.weights),raceName:clean(context.raceName||'レース名未登録'),date:clean(context.date),venue:clean(context.venue),raceNumber:clean(context.raceNumber),surface:clean(context.surface),distance,going:clean(context.going||'馬場未登録'),classLabel:clean(context.classLabel||classes[context.lapClass]||'比較クラス未確認'),settingsLabel:clean(context.settingsLabel||'標準設定'),createdLabel:clean(context.createdLabel),referenceRaces:Math.max(0,Number(selection.referenceRaces)||0),averageRaces:Math.max(0,Number(p?.count??selection.mainBasis?.count)||0),pattern:labels[selection.mainPattern]?selection.mainPattern:null,counts,front:front!=null&&distance?front*distance/400:null,back:back!=null&&distance?back*distance/400:null,interpolated:!!p?.interpolated,lapPoints,picks:(selection.picks||[]).map(h=>({mark:clean(h.mark),num:clean(h.num),name:clean(h.name),score:number(h.originalScore),baseScore:number(byNum.get(String(h.num))?.baseScore??h.baseScore),bonusScore:number(byNum.get(String(h.num))?.bonusScore??h.bonusScore),reason:clean(h.reason||'評価根拠は未登録です。')})),extras:(selection.extraCandidates||[]).map(h=>({num:clean(h.num),name:clean(h.name),score:number(h.score)}))};
 }
 function lapVisual(card,x,y,width){
  const colors={front_loaded:'#efd18b',back_loaded:'#7de8c5',even:'#bca8f5'},total=Object.values(card.counts).reduce((a,b)=>a+b,0);
  const text=(x,y,value,size=23,color='#b4c5d1',attrs='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${attrs}>${esc(value)}</text>`;
  let body=`<g data-chart="lap-pattern-distribution" role="img" aria-label="${esc(Object.entries(labels).map(([k,v])=>v+' '+card.counts[k]+'R').join('、'))}">`;
  body+=text(x,y,'同条件で見られたラップ構成',23,'#f5f0e6');y+=20;
  body+=`<rect x="${x}" y="${y}" width="${width}" height="20" rx="10" fill="#2c3c48"/>`;
  let left=x;for(const k of Object.keys(labels)){const w=total?width*card.counts[k]/total:0;if(w)body+=`<rect x="${left}" y="${y}" width="${w}" height="20" fill="${colors[k]}"/>`;left+=w;}
  y+=54;Object.entries(labels).forEach(([k,label],i)=>{const lx=x+i*width/3;body+=`<circle cx="${lx+6}" cy="${y-8}" r="6" fill="${colors[k]}"/>`+text(lx+22,y,`${label} ${card.counts[k]}R${total?' / '+Math.round(card.counts[k]/total*100)+'%':''}`,22);});body+='</g>';y+=44;
  const points=card.lapPoints||[];
  if(points.length>=2&&card.averageRaces>0){
   const top=y+45,height=150,left=x+76,right=x+width-22,min=Math.floor((Math.min(...points.map(p=>p.seconds))-.25)*2)/2,max=Math.ceil((Math.max(...points.map(p=>p.seconds))+.25)*2)/2;
   const px=d=>left+(d-points[0].distance)/(points.at(-1).distance-points[0].distance)*(right-left),py=v=>top+(v-min)/(max-min)*height;
   body+=`<g data-chart="average-lap" role="img" aria-label="同条件${card.averageRaces}レースの平均ラップ。200m換算、上ほど速い">`+text(x,y,`平均ラップの形  ·  ${card.averageRaces}R`,23,'#f5f0e6')+text(x+width,y,'200m換算 / 上ほど速い',20,'#91a8b7','text-anchor="end"');
   for(let i=0;i<3;i++){const v=min+(max-min)*i/2,gy=py(v);body+=`<line x1="${left}" x2="${right}" y1="${gy}" y2="${gy}" stroke="#314753"/>`+text(left-12,gy+7,v.toFixed(1)+'秒',18,'#91a8b7','text-anchor="end"');}
   const half=px(card.distance/2);if(half>=left&&half<=right)body+=`<line x1="${half}" x2="${half}" y1="${top}" y2="${top+height}" stroke="#7a909f" stroke-dasharray="5 6"/>`;
   const d=points.map((p,i)=>(i?'L':'M')+px(p.distance).toFixed(1)+','+py(p.seconds).toFixed(1)).join(' ');
   body+=`<path d="${d} L${right},${top+height} L${left},${top+height} Z" fill="#7de8c5" opacity=".08"/><path d="${d}" fill="none" stroke="#7de8c5" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
   for(const p of points)body+=`<circle cx="${px(p.distance)}" cy="${py(p.seconds)}" r="4" fill="#7de8c5"/>`;
   for(const [distance,anchor]of [[points[0].distance,'start'],[card.distance,'end']])body+=text(px(distance),top+height+32,distance+'m',19,'#91a8b7',`text-anchor="${anchor}"`);
   body+=text((left+right)/2,top+height+32,'累積距離（破線は距離の半分）',18,'#91a8b7','text-anchor="middle"')+'</g>';y=top+height+62;
  }else{body+=text(x,y,'平均ラップのグラフ：比較できる区間データなし',22,'#91a8b7');y+=38;}
  return {body,end:y};
 }
 function scoreBar(pick,x,y,width,max){
  const parts=Scale.parts(pick.baseScore,pick.bonusScore,max),total=pick.score==null?0:Math.max(0,Math.min(max,pick.score))/max*width;
  let body=`<g data-chart="horse-score" data-score-max="${max}" role="img" aria-label="${esc(parts?'基礎点'+pick.baseScore+'、適性加点'+pick.bonusScore:'総合'+pick.score+'点、内訳未登録')}、0〜${max}点の固定目盛り"><rect x="${x}" y="${y}" width="${width}" height="12" rx="5" fill="#2c3c48"/>`;
  if(parts)body+=`<rect data-score-part="base" x="${x}" y="${y}" width="${width*parts.base/100}" height="12" fill="#7de8c5"/><rect data-score-part="bonus" x="${x+width*parts.base/100}" y="${y}" width="${width*parts.bonus/100}" height="12" fill="#bca8f5"/>`;
  else body+=`<rect x="${x}" y="${y}" width="${total}" height="12" fill="#91a8b7"/>`;
  for(const tick of Scale.ticks(max)){const px=x+width*tick/max;body+=`<line x1="${px}" x2="${px}" y1="${y}" y2="${y+16}" stroke="#91a8b7" opacity=".35"/><text x="${px}" y="${y+36}" font-size="17" fill="#91a8b7" text-anchor="${tick===0?'start':tick===max?'end':'middle'}">${tick}</text>`;}
  return body+'</g>';
 }
 function svg(card){
  const W=1080,pad=64,width=W-pad*2;let y=86,body='';
  const t=(x,y,text,size=26,color='#dae4eb',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${esc(text)}</text>`;
  const lines=(text,x,y,width,size,color,lineHeight,extra='')=>{const rows=wrap(text,width,size);return {body:rows.map((s,i)=>t(x,y+i*lineHeight,s,size,color,extra)).join(''),height:rows.length*lineHeight};};
  body+=t(pad,y,'MA RACE NOTE  /  RACE PREVIEW',21,'#7de8c5','letter-spacing="2"');y+=49;
  body+=t(pad,y,[card.date,card.venue,card.raceNumber?card.raceNumber+'R':''].filter(Boolean).join('  ·  '),28,'#b4c5d1');y+=64;
  let block=lines(card.raceName,pad,y,width,52,'#f5f0e6',64,'font-weight="700"');body+=block.body;y+=block.height+4;
  block=lines([card.surface+(card.distance?card.distance+'m':''),card.going,card.settingsLabel].filter(Boolean).join('  ／  '),pad,y,width,25,'#b4c5d1',34);body+=block.body;y+=block.height+26;
  if(card.coverage){body+=t(pad,y,'評価済み '+card.coverage.scored+'頭 ／ 出走 '+card.coverage.total+'頭',25,'#b4c5d1');y+=38;if(card.coverage.total&&card.coverage.scored*5<=card.coverage.total*4){block=lines('⚠ 評価できている頭数が少ないため注意',pad,y,width,27,'#efd18b',36);body+=block.body;y+=block.height+12;}}
  body+=`<line x1="${pad}" y1="${y}" x2="1016" y2="${y}" stroke="#354653"/>`;y+=46;
  body+=t(pad,y,'今回の予想',29,'#f5f0e6','font-weight="700"');y+=24;
  body+=t(480,y-24,'■ 基礎点',19,'#7de8c5')+t(605,y-24,'■ 適性加点',19,'#bca8f5')+t(1016,y-24,'表示上限'+(card.scoreMax||10)+'点',19,'#91a8b7','text-anchor="end"');
  for(const pick of card.picks){const name=lines(pick.num+'番 '+pick.name,pad+112,y+44,650,36,'#f5f0e6',44,'font-weight="700"');const reason=lines(pick.reason,pad+112,y+44+name.height+67,width-142,26,'#b9cbd5',37);const height=44+name.height+67+reason.height+15;body+=`<rect x="${pad}" y="${y}" width="${width}" height="${height}" rx="18" fill="#182b36" stroke="#314753"/>`+t(pad+28,y+58,pick.mark,46,pick.mark==='☆'?'#bca8f5':'#efd18b','font-weight="700"')+name.body+t(992,y+40,pick.score==null?'未評価':pick.score.toFixed(2)+'点',24,'#7de8c5','text-anchor="end"')+scoreBar(pick,pad+112,y+44+name.height+9,width-144,card.scoreMax||10)+reason.body;y+=height+16;}
  if(!card.picks.length){body+=t(pad,y+34,'評価できる出走馬がありません',27,'#b9cbd5');y+=80;}
  y+=28;body+=t(pad,y,'この条件のラップ判断材料',29,'#f5f0e6','font-weight="700"');y+=45;
  const lapLines=[card.pattern?labels[card.pattern]+'想定':'ラップ構成は判断材料不足',`${card.venue}・${card.surface}${card.distance||''}m・${card.going} ／ ${card.classLabel}`,`分類済み ${card.referenceRaces}R ／ 平均ラップ ${card.averageRaces}R`];
  if(card.front!=null&&card.back!=null)lapLines.push(`平均：前半 ${card.front.toFixed(1)}秒 → 後半 ${card.back.toFixed(1)}秒`);
  for(const [i,line]of lapLines.entries()){block=lines(line,pad,y,width,i===0?32:25,i===0?'#7de8c5':'#b4c5d1',36,i===0?'font-weight="700"':'');body+=block.body;y+=block.height+7;}
  const visual=lapVisual(card,pad,y+10,width);body+=visual.body;y=visual.end;
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
