/* Public resume/manual updates. Fetches static files only; no Firebase calls. */
(()=>{
 'use strict';if(isEditMode)return;
 const VERSION='20261128-refresh1';let busy=null,lastCheck=0,hiddenAt=0;
 const box=document.createElement('div');box.id='publicRefreshControls';box.style.cssText='margin:0 auto 18px;max-width:860px;display:flex;gap:12px;align-items:center;flex-wrap:wrap';box.innerHTML='<button type="button" class="btn-back" id="publicRefreshButton">↻ 最新データを読み込む</button><span role="status" aria-live="polite" style="font-size:12px;color:var(--muted2)"></span>';
 const host=document.querySelector('#view-home .home-page')||document.querySelector('#view-home');if(host){const hero=host.querySelector('.home-hero');if(hero)hero.after(box);else host.prepend(box);}
 const button=box.querySelector('button'),status=box.querySelector('[role="status"]');
 async function staticFetch(url,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}
 async function shell(){const url=new URL('public-release.json',document.baseURI);url.searchParams.set('_check',Date.now());const r=await staticFetch(url,{cache:'no-store'});if(!r.ok)throw Error('更新情報を取得できません');const release=await r.json();if(!/^[a-zA-Z0-9-]+$/.test(release.shellVersion||''))throw Error('更新情報が不正です');if(release.shellVersion!==VERSION){const next=new URL(location.href);next.searchParams.set('_app',release.shellVersion);if(new URL(location.href).searchParams.get('_app')===release.shellVersion)throw Error('最新版の画面を取得できません。通信を確認して再度お試しください');location.replace(next.href);return true;}return false;}
 async function changed(){const src=window.publicSnapshotSource;if(!window.publicSnapshotLoadOK||!src?.etag)return true;const u=new URL(src.url,document.baseURI);u.searchParams.set('_check',Date.now());const r=await staticFetch(u,{method:'HEAD',cache:'no-store'});if(!r.ok)throw Error('最新データを確認できません');const tag=r.headers.get('ETag')||r.headers.get('Last-Modified');return !tag||tag!==src.etag;}
 async function update(force=false){if(!window.publicAppReady)return;if(busy)return busy;if(!force&&Date.now()-lastCheck<30000)return;lastCheck=Date.now();button.disabled=true;status.textContent='更新を確認中…';busy=(async()=>{try{if(await shell())return;if(!force&&!await changed()){status.textContent='最新データを表示しています';return;}const result=await fetchGitHubData();if(!result?.ok)throw Error('取得できませんでした。保存済みデータを表示しています');if(result.changed){const [days,rows]=await Promise.all([idbGetAll('raceDays'),loadAllHorses()]);raceDays=days;horses=rows;if(selectedHorse)selectedHorse=rows.find(h=>h.name===selectedHorse.name)||null;invalidateHorseCache();updateHomeStats();if(currentView==='horses'){if(selectedHorse)renderHorseDetail();else renderHorseList();}if(currentView==='publicPredict'&&window.SharedPredictionRuntime?.reviews)renderPublicPredict();}status.textContent='最新データを読み込みました';}catch(e){console.warn('[public-refresh]',e);status.textContent='更新できませんでした。保存済みデータは保持しています。「最新データを読み込む」で再試行してください。';}finally{button.disabled=false;busy=null;}})();return busy;}
 button.addEventListener('click',()=>update(true));
 window.addEventListener('pageshow',e=>{if(e.persisted)update();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')hiddenAt=Date.now();else if(hiddenAt){hiddenAt=0;update();}});
 window.addEventListener('online',()=>update());
 function ready(){status.textContent=window.publicSnapshotLoadOK?'起動時に公開データを読み込みました':'公開データの取得に失敗しています。更新ボタンで再試行してください';update();}
 window.addEventListener('public-app-ready',ready,{once:true});if(window.publicAppReady)ready();
 window.PublicRefresh={update,version:VERSION};
})();
