/* Branch-only Sengoku v2 bridge.
   This file neither edits the legacy catalog nor changes save/backup keys. */
(function(){
'use strict';
if(!window.SengokuV2||!window.PublicationRuntime)return;
let catalog=null,loadError='';
const $v2=id=>document.getElementById(id);
const oldCountOwned=countOwned,oldCatalogCount=catalogCardCount;
const oldShowPerson=showSengokuPerson,oldRender=renderSengoku,oldRefreshPins=refreshSengokuPins;
const oldPersist=persist,oldReconcile=reconcileSengokuVisits,oldToast=toastSengokuCards;

// An approved history ID is one card regardless of the number of sites.
countOwned=function(personId){return oldCountOwned(personId)+SengokuV2.acquired(catalog,sengokuFound,personId);};
catalogCardCount=function(personId){return oldCatalogCount(personId)+(catalog?[...catalog.histories.values()].filter(h=>h.personId===personId).length:0);};

function peopleAlreadyAcquired(){
 const ids=new Set();
 if(!catalog)return ids;
 for(const personId of catalog.people.keys())
  if(oldCountOwned(personId)>0||SengokuV2.acquired(catalog,sengokuFound,personId)>0)ids.add(personId);
 return ids;
}
function reconcileV2(){
 if(!catalog)return 0;
 const result=SengokuV2.award(catalog,state.visited,sengokuFound,peopleAlreadyAcquired());
 if(!result.added.length)return 0;
 // Reuse the v1 card store so backup-v3, restoration and historic awards remain intact.
 // Commit before changing in-memory state. Quota/write failures leave the old awards unchanged.
 writeStore(sengokuStoreKey,result.records);
 Object.assign(sengokuFound,result.records);
 oldRender();refreshSengokuPins();
 if(sengokuBulkImport)sengokuBatchDiscoveries.push(...result.added);
 else toastSengokuCards(result.added);
 return result.added.length;
}
function reconcileSafely(){
 try{return reconcileV2();}
 catch(error){console.warn('戦国v2の追加獲得を保存できません',error);status('訪問記録は維持しました。戦国v2カードの保存は未完了です：'+error.message);return 0;}
}
persist=function(){const res=oldPersist();reconcileSafely();return res;};
reconcileSengokuVisits=function(){const res=oldReconcile();reconcileSafely();return res;};
renderSengoku=function(){oldRender();if(!catalog)return;const count=[...catalog.histories.values()].filter(h=>!!sengokuFound[h.historyId]).length;
 const el=$v2('sengokuCount');if(el)el.textContent+=' ／ 戦国v2獲得 '+count+'枚';
};
toastSengokuCards=function(ids){
 const fresh=(ids||[]).filter(id=>catalog?.histories.has(id));
 const legacy=(ids||[]).filter(id=>!catalog?.histories.has(id));
 if(!fresh.length){oldToast(legacy);return;}
 const toast=$v2('sengokuToast');if(!toast)return;
 const people=new Set(fresh.map(id=>catalog.histories.get(id).personId));
 toast.replaceChildren();
 const message=document.createElement('div');message.textContent='戦国v2 経歴カード '+fresh.length+'枚獲得／人物 '+people.size+'人';
 const button=document.createElement('button');button.type='button';button.textContent='人物の経歴を見る';
 button.onclick=()=>{toast.hidden=true;selectCollectionMode('sengoku');$v2('sengokuPanel')?.scrollIntoView?.({behavior:'smooth',block:'start'});
  renderSengoku();if(people.size===1){const person=sengokuPeople.find(p=>p.id===[...people][0]);if(person)showSengokuPerson(person);}
 };
 toast.append(message,button);toast.hidden=false;
};
function appendV2Summary(person){
 if(!catalog||!catalog.people.has(person.id)||countOwned(person.id)===0)return;
 const data=catalog.people.get(person.id),box=$v2('sengokuDetail');if(!box)return;
 const section=document.createElement('section');section.className='sengoku-v2-narrative';
 const introHeading=document.createElement('h4');introHeading.textContent='人物紹介（戦国v2・承認版）';
 const intro=document.createElement('p');intro.textContent=data.introduction.text;
 const historyRows=[...catalog.histories.values()].filter(h=>h.personId===person.id)
  .sort((a,b)=>(a.eventYear??9999)-(b.eventYear??9999)||a.historyId.localeCompare(b.historyId));
 const progress=document.createElement('p');progress.className='small-note';
 progress.textContent='戦国v2経歴カード '+historyRows.filter(h=>!!sengokuFound[h.historyId]).length+' / '+historyRows.length+'枚';
 section.append(introHeading,intro,progress);
 if(!historyRows.length){const p=document.createElement('p');p.className='sengoku-v2-locked';p.textContent='経歴・史跡の⑥ユーザー最終承認待ち。未承認カードは読み込んでいません。';section.append(p);}
 for(const h of historyRows){
  const entry=document.createElement('div');entry.className='sengoku-era';
  const date=document.createElement('div');date.className='sengoku-year';date.textContent=h.yearText;
  const details=document.createElement('div');
  details.textContent=sengokuFound[h.historyId]?'📜 '+h.title+' — '+h.text:'🔒 未発見の足跡';
  entry.append(date,details);section.append(entry);
 }
 const storyTitle=document.createElement('h4');storyTitle.textContent='完成版ストーリー';section.append(storyTitle);
 const story=document.createElement('p');
 if(historyRows.length&&historyRows.every(h=>!!sengokuFound[h.historyId]))story.textContent=data.story.text;
 else{story.className='sengoku-v2-locked';story.textContent='承認済み経歴カードをすべて集めると解放されます。公開対象カードが0枚の間は解放しません。';}
 section.append(story);
 const heading=box.querySelector('h3');if(heading)heading.after(section);else box.prepend(section);
}
showSengokuPerson=function(person){oldShowPerson(person);if(catalog?.people.has(person.id))$v2('sengokuDetail')?.querySelector('.sengoku-profile')?.remove();appendV2Summary(person);};
refreshSengokuPins=function(){
 oldRefreshPins();if(!catalog||activeCollectionMode!=='sengoku')return;
 const showUnknown=$v2('showUnknownPins')?.checked;
 for(const site of catalog.sites.values()){
  if(!site.publicPin||!Array.isArray(site.point))continue;
  const related=[...catalog.linkSites.entries()].filter(([,sites])=>sites.has(site.siteId));
  if(selectedSengokuPersonId&&!related.some(([hid])=>catalog.histories.get(hid)?.personId===selectedSengokuPersonId&&!!sengokuFound[hid]))continue;
  const acquired=related.some(([hid])=>!!sengokuFound[hid]);
  if(!acquired&&!showUnknown)continue;
  const [lng,lat]=site.point;
  const mark=L.circleMarker([lat,lng],{radius:5,color:acquired?'#064e3b':'#334155',fillColor:acquired?'#34d399':'#94a3b8',weight:2,fillOpacity:1});
  mark.bindPopup(acquired?site.name:'未発見の歴史スポット');mark.addTo(sengokuPins);
 }
};
async function initializeV2(){
 try{
  const [a,b]=await Promise.all([
   fetch('./sengoku/v2/approved-three-person-staging.json',{cache:'no-cache'}),
   fetch('./data/title-registry.json',{cache:'no-cache'})
  ]);
  if(!a.ok||!b.ok)throw Error('承認パッケージまたは自治体一覧を読めません');
  const data=await a.json(),registry=await b.json();
  if(!Array.isArray(registry.areas))throw Error('自治体一覧が不正');
  // The import fails entirely if any supplied record lacks a current ⑥ approval.
  catalog=SengokuV2.validate(data,new Set(registry.areas.map(area=>area.code)),PublicationRuntime.sha256);
  const quality=$v2('sengokuQuality');
  if(quality)quality.textContent+=' ／ 戦国v2承認済み紹介・通史3人、経歴カード'+catalog.histories.size+'件（本番未公開）';
  // Legacy async catalog loading may still be in flight. Reconciliation is also hooked above.
  for(let n=0;n<50;n++){
   if(sengokuPeople.length&&sengokuCards.length){reconcileSafely();renderSengoku();refreshSengokuPins();return;}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  loadError='既存の戦国データ読込が未完了';
 }catch(error){
  catalog=null;loadError=error.message;
  console.warn('戦国v2承認データを隔離しました',error);
  const quality=$v2('sengokuQuality');if(quality)quality.textContent+=' ／ 戦国v2保留：'+loadError;
 }
}
initializeV2();
})();
