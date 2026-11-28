/* Display axis depends only on configured weights, never race entrants. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScoreDisplayScale=api;})(globalThis,()=>{
 'use strict';
 const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 function maximum(weights={}){const bonus=['venue','distance','condition'].reduce((sum,k)=>sum+Math.max(0,Math.min(6,Number.isFinite(Number(weights[k]))?Number(weights[k]):3))*.7,0);return Math.max(10,Math.min(20,Math.round((6+bonus)/5)*5));}
 function ticks(max=10){return [0,max/4,max/2,max*3/4,max];}
 function parts(base,bonus,max=10){if(!valid(base)||!valid(bonus))return null;const b=Math.min(max,base),extra=Math.min(max-b,bonus);return {base:100*b/max,bonus:100*extra/max};}
 return {maximum,ticks,parts};
});
