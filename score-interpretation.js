/* Pure display rules; never changes prediction scores. */
(function(root){
  'use strict';
  const EPS=1e-9;
  function band(value){
    if(value==null||!Number.isFinite(value))return {key:'missing',label:'判断材料不足'};
    if(value>=4-EPS)return {key:'high',label:'基礎評価が高い'};
    if(value>=3-EPS)return {key:'standard',label:'標準以上の評価'};
    if(value>=2-EPS)return {key:'below',label:'基準未満'};
    return {key:'low',label:'基礎評価は低め'};
  }
  function analyse(rows){
    const known=rows.filter(h=>h.baseScore!=null&&Number.isFinite(h.baseScore)&&Number.isFinite(h.customScore)&&Number.isFinite(h.bonusScore));
    const n=known.length,complete=n===rows.length;
    const rank=(h,key)=>1+known.filter(x=>x[key]>h[key]+EPS).length;
    const cutoff=n<=10?Math.max(1,Math.floor(n/2)):5;
    const candidates=[];
    if(complete&&n>=3)for(const h of known){
      const baseRank=rank(h,'baseScore'),totalRank=rank(h,'customScore'),bonusRank=rank(h,'bonusScore');
      if(h.bonusScore<1-EPS)continue;
      const rise=baseRank>cutoff&&totalRank<=cutoff&&baseRank-totalRank>=2;
      const bonusDistinct=known.some(x=>x.bonusScore<h.bonusScore-EPS);
      const special=bonusDistinct&&(n>10?baseRank>=10&&bonusRank<=3:baseRank>Math.floor(n/2)&&bonusRank<=Math.min(2,n));
      if(rise||special)candidates.push({horse:h,baseRank,totalRank,bonusRank,rise,special});
    }
    return {known,n,complete,cutoff,rank,candidates,allBelow:n>0&&known.every(h=>h.baseScore<3-EPS)};
  }
  function interpretation(h){
    const b=band(h.baseScore);if(b.key==='missing')return '採点に使える評価が不足しているため、判断を保留します。';
    if(h.baseScore<3-EPS&&h.bonusScore>=1-EPS)return '基礎評価は控えめですが、今回の条件で加点が大きいタイプ。人気がなければ、一発を期待する穴候補として注目。';
    if(h.baseScore>=3-EPS&&h.bonusScore>=1-EPS)return '基礎評価も標準以上で、今回の条件でも加点がある一頭。相手関係とオッズを合わせて比較したいタイプ。';
    if(h.baseScore>=3-EPS)return '条件ボーナスより基礎評価で上位を狙うタイプ。今回の相手関係を合わせて比較したい一頭。';
    return '基礎点は標準の3.0未満。現在の評価では強く推す材料は控えめです。';
  }
  const api={band,analyse,interpretation};if(typeof module==='object'&&module.exports)module.exports=api;else root.RaceScoreInterpretation=api;
})(globalThis);
