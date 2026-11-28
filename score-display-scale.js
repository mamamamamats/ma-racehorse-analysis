/* Shared fixed display axis. Does not normalize or change prediction scores. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScoreDisplayScale=api;})(globalThis,()=>{
 'use strict';const MAX=20,TICKS=[0,5,10,15,20];
 const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 function parts(base,bonus){if(!valid(base)||!valid(bonus))return null;const b=Math.min(MAX,base),extra=Math.min(MAX-b,bonus);return {base:100*b/MAX,bonus:100*extra/MAX};}
 return {MAX,TICKS,parts};
});
