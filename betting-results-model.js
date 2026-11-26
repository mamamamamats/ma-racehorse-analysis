/* 100-yen official payout tables; no odds estimates or automatic purchases. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RaceBettingModel=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const TYPES={win:{label:'単勝',size:1},place:{label:'複勝',size:1},quinella:{label:'馬連',size:2},wide:{label:'ワイド',size:2},exacta:{label:'馬単',size:2,ordered:true},trio:{label:'3連複',size:3},trifecta:{label:'3連単',size:3,ordered:true}};
 const key=(nums,type)=> (TYPES[type].ordered?[...nums]:[...nums].sort((a,b)=>a-b)).join('-');
 function validate(raw,entries){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||!raw.types||typeof raw.types!=='object'||Array.isArray(raw.types))throw Error('payouts.typesに券種別の確定払戻を指定してください');
  if(raw.sourceUrl){let url;try{url=new URL(raw.sourceUrl);}catch{throw Error('払戻の出典URLが不正です');}if(url.protocol!=='https:'||!/(^|\.)(jra\.go\.jp|jra\.jp)$/.test(url.hostname))throw Error('出典はJRA公式のhttps URLを指定してください');}
  const nums=new Set(entries.map(h=>Number(h.num))),types={};
  for(const [type,table]of Object.entries(raw.types)){
   if(!TYPES[type])throw Error('未対応の券種です：'+type);if(table&&table.confirmed!==true&&Array.isArray(table.payouts)&&!table.payouts.length&&!table.refundAll&&table.specialPayout==null)continue;if(!table||table.confirmed!==true)throw Error(TYPES[type].label+'は全的中組の払戻を確認してconfirmed:trueを指定してください');
   if(table.refundAll!=null&&typeof table.refundAll!=='boolean')throw Error('refundAllはtrueまたはfalseです');const payouts=table.payouts??[];if(!Array.isArray(payouts))throw Error('払戻はpayouts配列です');const seen=new Set();
   const normalized=payouts.map(p=>{if(!p||!Array.isArray(p.numbers)||p.numbers.length!==TYPES[type].size||p.numbers.some(n=>typeof n!=='number'||!Number.isInteger(n)||!nums.has(n))||new Set(p.numbers).size!==p.numbers.length)throw Error(TYPES[type].label+'の馬番・組合せが不正です');if(typeof p.yen!=='number'||!Number.isSafeInteger(p.yen)||p.yen<=0)throw Error('払戻金yenは100円あたりの正の整数です');const k=key(p.numbers,type);if(seen.has(k))throw Error(TYPES[type].label+'の的中組が重複しています');seen.add(k);return {numbers:TYPES[type].ordered?[...p.numbers]:[...p.numbers].sort((a,b)=>a-b),yen:p.yen};});
   if(table.specialPayout!=null&&(!Number.isInteger(table.specialPayout)||table.specialPayout<=0||table.specialPayout>100))throw Error('特払は100円あたりの整数（1〜100）です');
   if([!!table.refundAll,table.specialPayout!=null,!!normalized.length].filter(Boolean).length!==1)throw Error(TYPES[type].label+'は的中払戻・全返還・特払のいずれか1つを指定してください');
   types[type]={confirmed:true,payouts:normalized,...(table.refundAll?{refundAll:true}:{}),...(table.specialPayout!=null?{specialPayout:table.specialPayout}:{})};
  }
  if(!Object.keys(types).length)return null;return {schemaVersion:1,source:'JRA-transcribed',sourceUrl:raw.sourceUrl||'',types};
 }
 function tickets(nums,type){const size=TYPES[type].size,ordered=TYPES[type].ordered,out=[];function visit(prefix,left,start){if(!left){out.push(prefix);return;}for(let i=start;i<nums.length;i++){if(prefix.includes(nums[i]))continue;visit([...prefix,nums[i]],left-1,ordered?0:i+1);}}visit([],size,0);return out;}
 const MODES={formation:'印別フォーメーション',box:'印BOX',axis:'◎軸フォーメーション'};
 function strategyTickets(nums,type,mode='box',axis=null){
  if(!Object.hasOwn(MODES,mode))throw Error('未対応の買い方です');
  const unique=[...new Set(nums)].filter(n=>Number.isInteger(n)&&n>0);
  if(mode==='formation')throw Error('印別フォーメーションはformationTicketsを使ってください');
  if(mode==='box')return tickets(unique,type);
  if(!Number.isInteger(axis)||axis<1)return [];
  const bets=tickets([...new Set([axis,...unique])],type);
  return bets.filter(b=>TYPES[type].size===1?b[0]===axis:type==='exacta'?b[0]===axis:b.includes(axis));
 }
 function methodLabel(type,mode='box'){
  if(mode==='box')return TYPES[type].size>1?'BOX':'印対象';
  return ({win:'◎のみ',place:'◎のみ',quinella:'◎軸流し',wide:'◎軸流し',exacta:'◎1着固定',trio:'◎1頭軸流し',trifecta:'◎1頭軸マルチ'})[type];
 }
 const MARKS=['◎','○','▲','△','☆'];
 const DEFAULT_FORMATION={singleMarks:['◎'],pairMarks:['○','▲','☆'],secondMarks:['○','▲'],thirdMarks:['○','▲','△','☆'],singleAxisStyle:'all'};
 function formationSettings(raw={}){
  const out={};for(const k of ['singleMarks','pairMarks','secondMarks','thirdMarks']){const values=raw[k]??DEFAULT_FORMATION[k];if(!Array.isArray(values)||values.some(m=>!MARKS.includes(m)))throw Error('購入する印の設定が不正です');out[k]=MARKS.filter(m=>values.includes(m)&&(k==='singleMarks'||m!=='◎'));}
  out.singleAxisStyle=raw.singleAxisStyle??'all';if(!['all','formation'].includes(out.singleAxisStyle))throw Error('1頭軸マルチの設定が不正です');return out;
 }
 function formationDescription(raw={}){const o=formationSettings(raw);return `単複${o.singleMarks.join('')||'なし'}／2連◎→${o.pairMarks.join('')||'なし'}／3連複◎－${o.secondMarks.join('')||'なし'}－${o.thirdMarks.join('')||'なし'}／3連単1頭軸：${o.singleAxisStyle==='all'?'全相手':'2列目の印必須'}`;}
 function markGroups(prediction){
  const groups=Object.fromEntries(MARKS.map(m=>[m,[]]));
  for(const h of prediction.horses||[]){if(prediction.selectionVersion&&!h.selected)continue;const mark=h.mark||(!prediction.selectionVersion?MARKS[Number(h.rank)-1]:'');if(!groups[mark])continue;
   // Old rank-five stars were automatic; only the scenario versions generated conditional stars.
   if(mark==='☆'&&!/^(lap|pace)-selection-v/.test(prediction.selectionVersion||''))continue;
   const num=Number(h.num);if(Number.isInteger(num)&&num>0&&!groups[mark].includes(num))groups[mark].push(num);
  }return groups;
 }
 function formationTickets(prediction,type,variant='',raw={}){
  const o=formationSettings(raw),g=markGroups(prediction),pick=marks=>[...new Set(marks.flatMap(m=>g[m]))],dedupe=bets=>[...new Map(bets.map(b=>[key(b,type),TYPES[type].ordered?b:[...b].sort((a,b)=>a-b)])).values()];
  if(TYPES[type].size===1)return pick(o.singleMarks).map(n=>[n]);
  if(g['◎'].length!==1)return [];const axis=g['◎'][0],third=pick(o.thirdMarks).filter(n=>n!==axis);
  if(TYPES[type].size===2)return dedupe(pick(o.pairMarks).filter(n=>n!==axis).map(n=>[axis,n]));
  const formation=[];for(const second of pick(o.secondMarks))for(const last of third)if(second!==axis&&second!==last)formation.push([axis,second,last]);
  if(type==='trio'||variant==='fixed')return dedupe(formation);
  if(!variant){const triples=o.singleAxisStyle==='formation'?formation:tickets(third,'quinella').map(pair=>[axis,...pair]);return dedupe(triples.flatMap(t=>tickets(t,'trifecta')));}
  const triples=[];for(const m of variant==='dual-circle'?['○']:variant==='dual-triangle'?['▲']:['○','▲'])for(const second of g[m])for(const last of third)if(second!==axis&&second!==last)triples.push([axis,second,last]);
  return dedupe(triples.flatMap(t=>tickets(t,'trifecta')));
 }
 function specs(mode){const base=Object.entries(TYPES).map(([type,meta])=>({id:type,type,label:meta.label,variant:''}));if(mode!=='formation')return base;base.find(s=>s.type==='trifecta').label='3連単 1頭軸';return base.concat([
  {id:'trifecta_fixed',type:'trifecta',label:'3連単 着順固定',variant:'fixed'},
  {id:'trifecta_circle',type:'trifecta',label:'3連単 ◎○軸',variant:'dual-circle'},
  {id:'trifecta_triangle',type:'trifecta',label:'3連単 ◎▲軸',variant:'dual-triangle'},
  {id:'trifecta_dual_union',type:'trifecta',label:'3連単 2軸合算',variant:'dual-union'}]);}
 function formationMethod(type,variant,o){if(variant==='fixed')return '◎→'+(o.secondMarks.join('')||'なし')+'→'+(o.thirdMarks.join('')||'なし')+'（着順固定）';if(variant==='dual-circle')return '◎○2頭軸マルチ';if(variant==='dual-triangle')return '◎▲2頭軸マルチ';if(variant==='dual-union')return '◎○・◎▲の合算（重複除外）';return ({win:(o.singleMarks.join('')||'対象なし')+'の単勝',place:(o.singleMarks.join('')||'対象なし')+'の複勝',quinella:'◎→'+(o.pairMarks.join('')||'相手なし'),wide:'◎→'+(o.pairMarks.join('')||'相手なし'),exacta:'◎1着固定→'+(o.pairMarks.join('')||'相手なし'),trio:'◎－'+(o.secondMarks.join('')||'なし')+'－'+(o.thirdMarks.join('')||'なし'),trifecta:o.singleAxisStyle==='all'?'◎1頭軸マルチ（全相手）':'◎1頭軸マルチ（2列目の印必須）'})[type];}
 function simulate(rows,ranks=[1,2,3,4,5],stake=100,mode='box',options={}){
  if(!Object.hasOwn(MODES,mode))throw Error('未対応の買い方です');
  if(!Number.isSafeInteger(stake)||stake<100||stake>100000||stake%100)throw Error('1点の金額は100〜100,000円の100円単位です');
  const settings=formationSettings(options);
  return specs(mode).map(({id,type,label,variant})=>{const s={id,type,label,mode,method:mode==='formation'?formationMethod(type,variant,settings):methodLabel(type,mode),races:0,missing:0,insufficient:0,tickets:0,hits:0,hitRaces:0,gross:0,refund:0,net:0,payout:0,profit:0,roi:null,details:[]};
   for(const row of rows){if(!row.prediction)continue;const picks=(row.prediction.horses||[]).filter(h=>row.prediction.selectionVersion?!!h.selected&&ranks.some(rank=>h.mark===['◎','○','▲','△','☆'][rank-1]):ranks.includes(Number(h.rank))),nums=[...new Set(picks.map(h=>Number(h.num)))],anchor=(row.prediction.horses||[]).find(h=>row.prediction.selectionVersion?h.selected&&h.mark==='◎':Number(h.rank)===1),bets=mode==='formation'?formationTickets(row.prediction,type,variant,settings):strategyTickets(nums,type,mode,anchor?Number(anchor.num):null);if(!bets.length){s.insufficient++;continue;}const result=row.result,table=result?.payouts?.types?.[type];if(!row.outcome.complete||!table||table.confirmed!==true){s.missing++;continue;}
    let valid;try{valid=validate({types:{[type]:table}},row.race.horses||[]);}catch{s.missing++;continue;}if(!valid){s.missing++;continue;}
    const cancellations=new Set((result.horses||[]).filter(h=>h.status==='取消').map(h=>Number(h.num))),amounts=new Map(table.payouts.map(p=>[key(p.numbers,type),p.yen]));let refund=0,payout=0,hits=0;
    for(const bet of bets){if(table.refundAll||bet.some(n=>cancellations.has(n))){refund+=stake;continue;}const amount=amounts.get(key(bet,type));if(amount){payout+=amount*stake/100;hits++;}else if(table.specialPayout)payout+=table.specialPayout*stake/100;}
    const gross=bets.length*stake;s.races++;s.tickets+=bets.length;s.hits+=hits;if(hits)s.hitRaces++;s.gross+=gross;s.refund+=refund;s.payout+=payout;s.details.push({raceId:row.raceId,tickets:bets.length,gross,refund,payout,hits});
   }
   s.net=s.gross-s.refund;s.profit=s.payout-s.net;s.roi=s.net?s.payout/s.net*100:null;return s;
  });
 }
 return {TYPES,MODES,MARKS,DEFAULT_FORMATION,formationSettings,formationDescription,markGroups,formationTickets,key,validate,tickets,strategyTickets,methodLabel,simulate};
});
