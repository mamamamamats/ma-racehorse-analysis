/* Fill only missing, computable race classifications. Never infer frames or trouble from laps. */
(function(root,factory){const api=typeof module==='object'&&module.exports?factory(require('./pace-model'),require('./lap-metrics')):factory(root.PaceModel,root.RaceLapMetrics);if(typeof module==='object'&&module.exports)module.exports=api;else root.ReviewClassificationModel=api;})(globalThis,(P,L)=>{
 'use strict';
 const VERSION='missing-lap-classification-v1',validPace=v=>['high','middle','mid','slow'].includes(v),primary=v=>Object.hasOwn(L.LABELS,v);
 function fill(record,baseline,at=''){
  const stored=record.events;
  if(Array.isArray(stored))return {events:null,patch:null,fields:[],reason:'旧形式の事象配列'};
  const events={...(stored&&typeof stored==='object'?stored:{})},fields=[],patch={},parsed=P.parse(record);
  const raw=Array.isArray(events.lapPattern)?events.lapPattern:events.lapPattern?[events.lapPattern]:[];
  if(parsed&&!raw.some(primary)){
   const split=L.splitPattern(parsed.laps,parsed.segments);events.lapPattern=[...new Set([...raw.filter(x=>x!=='unknown'),split.pattern])];fields.push('lapPattern');
   patch.lapPatternMeta={source:'auto-half',method:VERSION,...P.halves(parsed),deltaPer200:split.delta,updatedAt:at};
  }
  let pace=null;if(!validPace(events.pace)&&baseline){
   pace=P.classify(record,baseline);
   if(validPace(pace.pace)){events.pace=pace.pace;fields.push('pace');Object.assign(patch,P.patch(record,pace,at)||{});patch.paceMeta={...pace,source:'auto',updatedAt:at};}
  }
  if(fields.length)patch.events=events;
  return {events:Object.keys(events).length?events:null,patch:fields.length?patch:null,fields,pace,reason:!parsed?'有効な実数ラップなし':pace?.reason||null};
 }
 return {VERSION,fill,validPace};
});
