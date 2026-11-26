/* Parse saved JRA web tool responses offline. Never fetches or updates DB.
 * node scripts/collect-jra-history-sources.cjs --work-dir /path/to/workdir
 * workdir/sources/*.json = saved tool responses; optional profile-urls.json maps names to URLs. */
const fs=require('fs'),path=require('path'),args=process.argv.slice(2),arg=(k,f)=>{const i=args.indexOf(k);return i<0?f:args[i+1];},dir=path.resolve(arg('--work-dir','.local/jra-history-linking')),sources=path.join(dir,'sources'),pages=new Map(),urls=new Map(Object.entries(fs.existsSync(path.join(dir,'profile-urls.json'))?JSON.parse(fs.readFileSync(path.join(dir,'profile-urls.json'))):{}));
const sourceName=segment=>{
 const clean=segment.replace(/【\d+†Image[^】]*】/g,'').replace(/【\d+†([^】]*)】/g,'$1').replace(/Image:\s*(?:マルガイ|マルチ|カクチ|マルカク)/g,'');
 return clean.match(/競走馬情報[　 \t]*([ァ-ヺー]+)[　 \t]*(?=[A-Za-z])/)?.[1];
};
const sourceUrl=segment=>segment.match(/https:\/\/www\.jra\.go\.jp\/JRADB\/accessU\.html\?CNAME=[^\s;)]*/)?.[0]?.replace(/%2F/gi,'/');
const segments=fs.readdirSync(sources).filter(x=>x.endsWith('.json')).flatMap(file=>{const r=JSON.parse(fs.readFileSync(path.join(sources,file)));return (r.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n').split(/\n-+\n/);});
// Discover every explicitly named URL before reading fragments. A preferred URL is
// not an identity mapping for the horse's other official endpoint variants.
const namesByUrl=new Map(),ambiguousUrls=new Set();
for(const segment of segments){const name=sourceName(segment),url=sourceUrl(segment);if(!name||!url)continue;if(namesByUrl.has(url)&&namesByUrl.get(url)!==name)ambiguousUrls.add(url);else namesByUrl.set(url,name);}
for(const [name,url]of urls)if(!namesByUrl.has(url))namesByUrl.set(url,name);
for(const segment of segments){const url=sourceUrl(segment);if(!url||ambiguousUrls.has(url))continue;const name=namesByUrl.get(url);if(!name)continue;if(!urls.has(name)||url.includes('pw01dud0'))urls.set(name,url);const layout=segment.match(/Total lines: (\d+)/)?.[1]||'unknown',pageKey=url+'|'+layout;if(!pages.has(pageKey))pages.set(pageKey,{name,url,lines:new Map(),conflicts:new Set()});const p=pages.get(pageKey);for(const m of segment.matchAll(/^L(\d+):\s?(.*)$/gm)){const n=Number(m[1]);if(p.lines.has(n)&&p.lines.get(n)!==m[2])p.conflicts.add(n);p.lines.set(n,m[2]);}}
const histories=[];for(const p of pages.values()){const ordered=[...p.lines].sort((a,b)=>a[0]-b[0]),head=ordered.find(([n,s])=>/年月日\s*\|\s*場\s*\|\s*レース名/.test(s));if(!head)continue;const end=ordered.find(([n,s])=>n>head[0]&&/^(?:\*\s*)?## (?:出走・出馬投票履歴|レース条件別成績)/.test(s.trim())),races=[];for(const [n,line]of ordered){if(n<=head[0]||end&&n>=end[0])continue;const cells=line.replace(/【\d+†([^】]*)】/g,'$1').split('|').map(x=>x.trim()),d=cells[0]?.match(/^(20\d{2})年(\d+)月(\d+)日$/);if(!d||cells.length<8)continue;const finish=/^\d+$/.test(cells[7])?Number(cells[7]):null;races.push({date:d[1]+'/'+d[2]+'/'+d[3],venue:cells[1],name:cells[2].replace(/Image:.*$/,''),track:cells[3],going:cells[4],fieldSize:Number(cells[5])||null,finish,status:finish?'':cells[7]});}
 const missing=[];if(end)for(let n=head[0];n<=end[0];n++)if(!p.lines.has(n))missing.push(n);
 const conflictingLines=[...p.conflicts].filter(n=>n>=head[0]&&(!end||n<=end[0]));
 histories.push({name:p.name,url:p.url,complete:!!end&&!missing.length&&!conflictingLines.length&&new Set(races.map(r=>r.date+'|'+r.venue)).size===races.length,retrievedAt:new Date().toISOString(),tableStart:head[0],tableEnd:end?.[0],missingLines:missing,conflictingLines,races});}
const byName=new Map();for(const h of histories){const old=byName.get(h.name);if(!old||h.complete&&!old.complete||h.complete===old.complete&&h.races.length>old.races.length)byName.set(h.name,h);}
fs.writeFileSync(path.join(dir,'histories.json'),JSON.stringify([...byName.values()],null,2));fs.writeFileSync(path.join(dir,'profile-urls.json'),JSON.stringify(Object.fromEntries(urls),null,2));console.log(JSON.stringify({urls:urls.size,histories:byName.size,complete:[...byName.values()].filter(h=>h.complete).length,incomplete:[...byName.values()].filter(h=>!h.complete).map(h=>({name:h.name,rows:h.races.length,from:h.tableStart,to:h.tableEnd,missing:h.missingLines.length}))}));
