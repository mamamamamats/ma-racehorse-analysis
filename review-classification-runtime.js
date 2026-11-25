/* Shared read-only completion for charts and horse badges. Explicit saving uses raw records. */
(()=>{
 'use strict';const C=window.ReviewClassificationModel,P=window.PaceModel;let source=null,baseline=null,cache=new WeakMap();
 function get(record){const records=raceConditionReviewRecords||window.SharedPredictionRuntime?.reviews||wholeReviewRankingRecords||[];
  if(source!==records){source=records;baseline=P.build(records);cache=new WeakMap();}
  if(!record||typeof record!=='object')return null;
  if(!cache.has(record))cache.set(record,C.fill(record,baseline));
  return cache.get(record);
 }
 window.addEventListener('prediction-data-changed',event=>{if(event.detail?.collection==='raceReviews'){source=null;cache=new WeakMap();}});
 window.ReviewClassificationRuntime={get,events:record=>get(record)?.events||null};
})();
