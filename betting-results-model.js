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
 function simulate(rows,ranks=[1,2,3,4,5],stake=100){
  if(!Number.isSafeInteger(stake)||stake<100||stake>100000||stake%100)throw Error('1点の金額は100〜100,000円の100円単位です');
  return Object.entries(TYPES).map(([type,meta])=>{const s={type,label:meta.label,races:0,missing:0,insufficient:0,tickets:0,hits:0,hitRaces:0,gross:0,refund:0,net:0,payout:0,profit:0,roi:null,details:[]};
   for(const row of rows){if(!row.prediction)continue;const picks=(row.prediction.horses||[]).filter(h=>ranks.includes(Number(h.rank))),nums=[...new Set(picks.map(h=>Number(h.num)))],bets=tickets(nums,type);if(!bets.length){s.insufficient++;continue;}const result=row.result,table=result?.payouts?.types?.[type];if(!row.outcome.complete||!table||table.confirmed!==true){s.missing++;continue;}
    let valid;try{valid=validate({types:{[type]:table}},row.race.horses||[]);}catch{s.missing++;continue;}if(!valid){s.missing++;continue;}
    const cancellations=new Set((result.horses||[]).filter(h=>h.status==='取消').map(h=>Number(h.num))),amounts=new Map(table.payouts.map(p=>[key(p.numbers,type),p.yen]));let refund=0,payout=0,hits=0;
    for(const bet of bets){if(table.refundAll||bet.some(n=>cancellations.has(n))){refund+=stake;continue;}const amount=amounts.get(key(bet,type));if(amount){payout+=amount*stake/100;hits++;}else if(table.specialPayout)payout+=table.specialPayout*stake/100;}
    const gross=bets.length*stake;s.races++;s.tickets+=bets.length;s.hits+=hits;if(hits)s.hitRaces++;s.gross+=gross;s.refund+=refund;s.payout+=payout;s.details.push({raceId:row.raceId,tickets:bets.length,gross,refund,payout,hits});
   }
   s.net=s.gross-s.refund;s.profit=s.payout-s.net;s.roi=s.net?s.payout/s.net*100:null;return s;
  });
 }
 return {TYPES,key,validate,tickets,simulate};
});
