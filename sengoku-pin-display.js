/* Player-facing historic-site display. Internal pinReview.restriction is evidence, never UI text.
 * Structured display text must carry its own B + ⑥ approval; unapproved candidates
 * remain in a separate staging fixture and cannot be installed here.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SengokuPinDisplay=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const POLICY_LABELS=Object.freeze({green:'通常見学可能',yellow:'注意あり',red:'危険・立入制限あり'});
 const SAFE_URL=/^https:\/\/[^\s]+$/;
 function safeUrl(url){
  if(typeof url!=='string'||!SAFE_URL.test(url))return false;
  try{const parsed=new URL(url);return parsed.protocol==='https:'&&!!parsed.hostname;}catch{return false;}
 }
 // Only newly and individually approved structured data may enter the player view.
 // Preserve original approved history and internal site/pin review evidence.
 function approvedDisplay(site){
  const p=site?.pinDisplay,a=p?.approval;
  if(!p||!a||p.siteId!==site.siteId||a.user!=='公開OK'||
      a.bReview!=='B合格'||!Number.isInteger(a.sheetRow)||a.sheetRow<2||
      !/^v[1-9]\d*$/.test(a.version||'')||
      a.sourceId!==site.siteId||a.kind!=='史跡見学表示')return null;
  if(p.notice!==null&&p.notice!==undefined&&typeof p.notice!=='string')return null;
  if(p.officialInfoUrl!==null&&p.officialInfoUrl!==undefined&&!safeUrl(p.officialInfoUrl))return null;
  if(!Array.isArray(p.attributions)||!p.attributions.every(x=>
      x&&typeof x.label==='string'&&x.label.length>0&&
      (x.url===null||x.url===undefined||safeUrl(x.url))))return null;
  return p;
 }
 function asLink(document,url,label){
  const a=document.createElement('a');
  a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;
  return a;
 }
 function makePopup(site,core,document){
  const details=core.pinDetails(site),structured=approvedDisplay(site);
  const popup=document.createElement('div');popup.className='sengoku-pin-popup';
  const h=document.createElement('h3');h.textContent=details.name;popup.append(h);
  // The approved ③C history is separate from B-only visit/safety notes.
  const story=document.createElement('p');story.className='sengoku-pin-history';
  story.textContent=site.description;popup.append(story);
  function field(label,value,klass){
   if(value===null||value===undefined||value==='')return;
   const p=document.createElement('p'),strong=document.createElement('strong');
   if(klass)p.className=klass;
   strong.textContent=label;
   p.append(strong,document.createTextNode(String(value)));popup.append(p);
  }
  field('所在地：',details.municipality);
  const status=site.pinReview.accessStatus;
  field('見学状況：',details.access.symbol+' '+details.access.colorName+'（'+POLICY_LABELS[status]+'）');
  if(structured?.notice)field('見学上の注意：',structured.notice,'sengoku-pin-visit');
  field('表示位置の種類：',details.positionKind);
  field('情報確認日：',details.checkedAt);
  if(structured?.officialInfoUrl){
   const p=document.createElement('p');p.className='sengoku-pin-official';
   const strong=document.createElement('strong');strong.textContent='公式案内：';
   p.append(strong,asLink(document,structured.officialInfoUrl,'公式の見学案内を開く'));
   popup.append(p);
  }
  if(structured?.attributions?.length){
   const p=document.createElement('p');p.className='sengoku-pin-attribution';
   const strong=document.createElement('strong');strong.textContent='出典・ライセンス帰属：';
   p.append(strong);
   structured.attributions.forEach((x,i)=>{
    if(i)p.append(document.createTextNode(' / '));
    p.append(x.url?asLink(document,x.url,x.label):document.createTextNode(x.label));
   });
   popup.append(p);
  }
  const caution=document.createElement('p');caution.className='pin-caution';
  caution.textContent=details.guidance+(details.noRouting?' 立入制限のある場所への接近や経路案内は行いません。':'');
  popup.append(caution);
  return popup;
 }
 // Each separator is a DOM text node placed strictly between valid links.
 // Source URLs and their order are never changed or deduplicated.
 function appendSourceLinks(container,sourceUrls,document){
  const valid=(Array.isArray(sourceUrls)?sourceUrls:[]).filter(safeUrl);
  if(!valid.length)return 0;
  const group=document.createElement('span');group.className='sengoku-source-links';
  valid.forEach((url,i)=>{
   if(i)group.append(document.createTextNode(' / '));
   group.append(asLink(document,url,'出典を読む'));
  });
  container.append(group);
  return valid.length;
 }
 return {safeUrl,approvedDisplay,makePopup,appendSourceLinks,POLICY_LABELS};
});
