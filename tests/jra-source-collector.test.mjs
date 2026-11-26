import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../scripts/collect-jra-history-sources.cjs',import.meta.url));
function parse(pages){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jra-source-'));try{fs.mkdirSync(path.join(dir,'sources'));pages.forEach((text,i)=>fs.writeFileSync(path.join(dir,'sources',i+'.json'),JSON.stringify({content:[{type:'text',text}]})));const r=spawnSync(process.execPath,[script,'--work-dir',dir],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(fs.readFileSync(path.join(dir,'histories.json')));}finally{fs.rmSync(dir,{recursive:true,force:true});}}
const title='競走馬情報 テストホース TestHorse (https://www.jra.go.jp/JRADB/accessU.html?CNAME=example/01)\n';
const header='L10: 年月日 | 場 | レース名 | 距離 | 馬場 | 頭数 | 人気 | 着順\n',row='L11: 2026年11月1日 | 東京 | 3歳上1勝クラス | 芝1600 | 良 | 12 | 4 | 2\n',end='L12: ## レース条件別成績\n';
test('official headings with spaces resolve names and a complete start table',()=>{const [h]=parse([title+'Total lines: 100\n'+header+row+end]);assert.equal(h.name,'テストホース');assert.equal(h.complete,true);assert.equal(h.races[0].finish,2);});
test('missing rows or mismatched page layouts cannot be treated as full official history',()=>{const [gap]=parse([title+'Total lines: 100\n'+header+end]);assert.equal(gap.complete,false);assert.deepEqual(gap.missingLines,[11]);const [mixed]=parse([title+'Total lines: 100\n'+header+row,title+'Total lines: 101\n'+end]);assert.equal(mixed.complete,false);});
test('linked image badges in headings never become horse names',()=>{
 const [h]=parse(['競走馬情報 JRA (https://www.jra.go.jp/JRADB/accessU.html?CNAME=example/01)\nTotal lines: 100\nL1: # 【179†Image】競走馬情報【180†Image: マルチ】テストホースTestHorse（JPN）\n'+header+row+end]);assert.equal(h.name,'テストホース');assert.equal(h.complete,true);
});
test('conflicting cached table rows are held and footer help is not a table boundary',()=>{
 const [h]=parse([title+'Total lines: 100\n'+header+row+end,title+'Total lines: 100\n'+row.replace(' | 4 | 2',' | 4 | 3')]);assert.equal(h.complete,false);assert.deepEqual(h.conflictingLines,[11]);
 const [footer]=parse([title+'Total lines: 100\n'+header+row+'L12: ### 出走・出馬投票履歴\n']);assert.equal(footer.complete,false);
});
