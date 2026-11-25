/* Small static evidence index lets existing browser caches use verified undated reviews.
 * No horse data is edited here. A changed comment/evaluation fails the exact signature check. */
(()=>{
 'use strict';
 fetch(new URL('verified-review-links.json',document.baseURI),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('照合索引未取得');return r.json();}).then(data=>{
  if(data.schemaVersion!==1||!Array.isArray(data.links))return;
  window.HorseReviewLink.installVerifiedLinks(data.links);
  if(typeof horseRaceRefreshEventBadges==='function')horseRaceRefreshEventBadges();
  if(!isEditMode&&currentView==='publicPredict'&&typeof renderPublicPredict==='function')renderPublicPredict();
 }).catch(e=>console.info('[keiba] 公式履歴の照合索引:',e.message));
})();
