/* v2 approved pin display renderer.
 * 16 separately user-approved ⑥ revisions are structured; remaining 403
 * retain their legacy approved safety notes and attribution until their own
 * display revisions have the required B and user approval.
 * No mutable user records, site IDs, acquisition logic or raw review text change.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.SengokuPinDisplay=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const labels={green:'通常見学可能',yellow:'注意あり',red:'危険・立入制限あり'};
 const safeUrl=url=>{
  if(typeof url!=='string'||!/^https:\/\/[^\s]+$/.test(url))return false;
  try{const parsed=new URL(url);return parsed.protocol==='https:'&&!!parsed.hostname;}catch{return false}
 };
 function approvedDisplay(site,registry){
  if(!site||site.publicPin!==true||!site.pinReview||!Array.isArray(site.point))return null;
  const r=registry?.[site.siteId],a=r?.approval;
  if(!r||r.siteId!==site.siteId||!a||a.sourceId!==site.siteId||a.kind!=='史跡'||
    a.user!=='公開OK'||a.quality!=='品質合格'||a.bReview!=='B合格'||
    a.sourceMatch!=='一致'||a.rights!=='地点確認済・権利OK'||
    a.version!=='v2'||!Number.isInteger(a.sheetRow)||a.sheetRow<2||
    !Array.isArray(r.expectedPoint)||r.expectedPoint.length!==2||
    !r.expectedPoint.every((n,i)=>n===site.point[i])||
    !Number.isInteger(r.positionSourceSheetRow)||
    r.positionSourceSheetRow!==site.pinReview.sourceSheetRow||
    !['green','yellow','red'].includes(r.accessStatus)||
    typeof r.historyText!=='string'||!r.historyText||
    typeof r.notice!=='string'||!r.notice||
    !/^\d{4}-\d{2}-\d{2}$/.test(r.checkedAt||'')||
    !(r.officialInfoUrl===null||safeUrl(r.officialInfoUrl))||
    !Array.isArray(r.attributions)||!r.attributions.length||
    !r.attributions.every(x=>x&&typeof x.label==='string'&&x.label&&safeUrl(x.url)))return null;
  return r;
 }
 function statusFor(site,registry){return approvedDisplay(site,registry)?.accessStatus||site.pinReview.accessStatus}
 function link(document,url,label){
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;return a;
 }
 function makePopup(site,core,document,registry){
  const d=core.pinDetails(site),r=approvedDisplay(site,registry);
  const popup=document.createElement('div');popup.className='sengoku-pin-popup';
  const heading=document.createElement('h3');heading.textContent=d.name;popup.append(heading);
  const history=document.createElement('p');history.className='sengoku-pin-history';
  history.textContent=r?.historyText||site.description;popup.append(history);
  function field(label,value,klass){
   if(value===null||value===undefined||value==='')return;
   const p=document.createElement('p'),b=document.createElement('strong');
   if(klass)p.className=klass;
   b.textContent=label;p.append(b,document.createTextNode(String(value)));popup.append(p);
  }
  field('所在地：',d.municipality);
  const p=r?core.pinPresentation(r.accessStatus):d.access;
  field('見学状況：',p.symbol+' '+p.colorName+'（'+labels[statusFor(site,registry)]+'）');
  if(r){
   field('見学上の注意：',r.notice,'sengoku-pin-visit');
   field('表示位置の種類：',d.positionKind);
   field('情報確認日：',r.checkedAt);
   if(r.officialInfoUrl){
    const official=document.createElement('p'),strong=document.createElement('strong');
    official.className='sengoku-pin-official';strong.textContent='公式案内：';
    official.append(strong,link(document,r.officialInfoUrl,'この史跡の公式案内を開く'));popup.append(official);
   }
   const credit=document.createElement('p'),strong=document.createElement('strong');
   credit.className='sengoku-pin-attribution';strong.textContent='出典・ライセンス帰属：';credit.append(strong);
   r.attributions.forEach((a,i)=>{
    if(i)credit.append(document.createTextNode(' / '));
    credit.append(link(document,a.url,a.label));
   });
   popup.append(credit);
  }else{
   // Legacy view: keep previously published safety and credit information
   // until an individually B-reviewed and ⑥-approved structured replacement exists.
   field('表示位置：',d.positionKind);
   if(d.restriction)field('立入制限：',d.restriction);
   field('情報確認日：',d.checkedAt);
   if(d.officialInfoUrl){
    const official=document.createElement('p');
    official.append(link(document,d.officialInfoUrl,'見学案内・制限情報（外部サイト）'));
    popup.append(official);
   }
   // Independently B/⑥-approved Phase1 pins carry their own position-license
   // credits. Keep earlier published legacy pin display and the 16 structured
   // v2 approvals unchanged. Never expose unapproved ③/⑤ management notes.
   const credits=site.pinReview?.attributions;
   if(Array.isArray(credits)&&credits.length&&credits.every(a=>
     a&&typeof a.label==='string'&&a.label.trim()&&safeUrl(a.url))){
    const line=document.createElement('p'),heading=document.createElement('strong');
    line.className='sengoku-pin-attribution';
    heading.textContent='出典・ライセンス帰属：';
    line.append(heading);
    for(let i=0;i<credits.length;i++){
     if(i)line.append(document.createTextNode(' / '));
     line.append(link(document,credits[i].url,credits[i].label));
    }
    popup.append(line);
   }
  }
  const note=document.createElement('p');note.className='pin-caution';
  const isRestricted=statusFor(site,registry)==='red';
  note.textContent='史跡は対象自治体の制覇で収集できます。100m接近は不要です。 '+d.guidance+(isRestricted?' 立入制限のある場所への接近・経路案内は行いません。':'');
  popup.append(note);
  return popup;
 }
 return {approvedDisplay,statusFor,makePopup,safeUrl,labels};
});
