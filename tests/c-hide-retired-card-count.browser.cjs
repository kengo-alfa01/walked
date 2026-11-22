'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webkit,chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const doc=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-c-20261120-new9-80.json'),'utf8'));
const assets=process.env.WALKED_BROWSER_ASSETS||path.join(root,'.qa-assets');
const base=process.env.WALKED_BASE_URL||'http://127.0.0.1:8765';
const retired=doc.retiredHistories.map(r=>r.history.historyId);
const retiredSet=new Set(retired);
const activeSet=new Set(doc.histories.map(h=>h.historyId));
const tachibana=doc.people.find(p=>p.name.includes('立花宗茂'));
assert.ok(tachibana,'Tachibana must be in approved people');
const tachibanaRetired=doc.retiredHistories.filter(x=>x.history.personId===tachibana.personId).map(x=>x.history.historyId);
assert.ok(tachibanaRetired.length>0,'Tachibana must have obsolete records to test');
const retiredOnly=Object.fromEntries(retired.map(id=>[id,{at:'2020-01-02',basis:'retired'}]));
const activeByPerson=new Map();
for(const h of doc.histories)if(!activeByPerson.has(h.personId))activeByPerson.set(h.personId,h.historyId);
const activeSaved=Object.fromEntries([...activeByPerson.values()].map(id=>[id,{at:'2024-05-06',basis:'approved'}]));
const hybrid={...retiredOnly,...activeSaved,'obsolete-unknown-history':{at:'2016-01-01',basis:'retired'}};
const checkpoint={
 format:'walked-backup-v3',createdAt:'2024-05-01T00:00:00Z',visited:{},
 cards:{...hybrid},titles:{awards:{},selected:null}
};
async function routeAssets(page){
 await page.route('**/municipalities.topojson',r=>r.fulfill({path:path.join(assets,'municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',r=>r.fulfill({path:path.join(assets,'topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',r=>r.abort());
}
async function open(browserType,options,savedCards){
 const browser=await browserType.launch({headless:true});
 const context=await browser.newContext({...options});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await routeAssets(page);
 await page.addInitScript(([cards,back])=>{
   localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify(cards));
   localStorage.setItem('walked_municipal_v2',JSON.stringify({}));
   localStorage.setItem('walked_before_restore_v1',JSON.stringify(back));
 },[savedCards,checkpoint]);
 await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined'&&sengokuV2Catalog?.people?.size===74,null,{timeout:35000});
 await page.locator('[data-collection-mode="sengoku"]').click();
 return {browser,context,page,errors};
}
const contexts=[
 ['WebKit iPhone',webkit,{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}],
 ['Chromium desktop',chromium,{viewport:{width:1332,height:717},deviceScaleFactor:1,isMobile:false,hasTouch:false}]
];
for(const [name,browserType,opts] of contexts){
 test('C purge: only obsolete saved cards do not count as earned — '+name,{timeout:140000},async()=>{
  const {browser,page,errors}=await open(browserType,opts,retiredOnly);
  try{
   const result=await page.evaluate((personId)=>{
    const raw=JSON.parse(localStorage.getItem('walked_sengoku_cards_v1'));
    const checkpoint=JSON.parse(localStorage.getItem('walked_before_restore_v1'));
    const summary=document.getElementById('sengokuCount').textContent;
    const savedBackup=currentBackup();
    const tiles=[...document.querySelectorAll('#sengokuList .sengoku-person')].map(x=>x.textContent);
    const oldInMemory=Object.keys(sengokuFound).filter(id=>sengokuV2Catalog.retiredHistories.has(id));
    return {cards:Object.keys(raw),ownedInMemory:Object.keys(sengokuFound),summary,tiles,
      currentOwned:countOwned(personId),
      snapshotOld:Object.keys(checkpoint.cards).filter(id=>sengokuV2Catalog.retiredHistories.has(id)),
      backupOld:Object.keys(savedBackup.cards).filter(id=>sengokuV2Catalog.retiredHistories.has(id)),
      oldInMemory,storageRetiredCount:Object.keys(raw).length,
      people:sengokuV2Catalog.people.size,history:sengokuV2Catalog.histories.size};
   },tachibana.personId);
   assert.equal(result.people,74);assert.equal(result.history,1251);
   assert.deepEqual(result.cards,[],'retired IDs must be deleted from localStorage');
   assert.deepEqual(result.ownedInMemory,[]);
   assert.deepEqual(result.snapshotOld,[],'old recovery checkpoint must be migrated');
   assert.deepEqual(result.backupOld,[],'new export must not contain retired IDs');
   assert.deepEqual(result.oldInMemory,[]);
   assert.equal(result.currentOwned,0,'Tachibana has no current card');
   assert.deepEqual(result.tiles,[],'no character with only obsolete cards is earned');
   assert.match(result.summary,/獲得人物 0人／カード 0枚/);
   assert.deepEqual(errors,[]);
   console.log('C_RETIRED_ONLY_PURGED_PASS',JSON.stringify({name,retiredSeed:retired.length,after:result.cards.length,tachibanaOwned:result.currentOwned,summary:result.summary}));
  }finally{await browser.close()}
 });
 test('C purge: active cards survive and backup cannot restore retired IDs — '+name,{timeout:150000},async()=>{
  const {browser,page,errors}=await open(browserType,opts,hybrid);
  try{
   const initial=await page.evaluate((ids)=>{
    const current=JSON.parse(localStorage.getItem('walked_sengoku_cards_v1'));
    const snap=JSON.parse(localStorage.getItem('walked_before_restore_v1'));
    const people=[...document.querySelectorAll('#sengokuList .sengoku-person')].map(b=>{
     const name=b.querySelector('strong')?.textContent||'',p=sengokuPeople.find(p=>p.name===name);
     return {name,id:p?.id,label:b.querySelector('small')?.textContent||'',
       expected:countOwned(p.id)+' / '+catalogCardCount(p.id)+' 枚'};
    });
    const tach=sengokuPeople.find(p=>p.id===ids.tachibana);
    return{people,current,snap,summary:document.getElementById('sengokuCount').textContent,tachName:tach.name,
      former:[...sengokuV2Catalog.retiredHistories.keys()].filter(x=>Object.prototype.hasOwnProperty.call(sengokuFound,x)),
      activeCount:[...sengokuV2Catalog.histories.keys()].filter(x=>Object.prototype.hasOwnProperty.call(sengokuFound,x)).length,
      backup:currentBackup()};
   },{tachibana:tachibana.personId});
   assert.equal(initial.people.length,74);
   // Existing location awards can legitimately unlock associated non-place histories.
   // Every pre-existing active record must survive, but the total may increase.
   assert.ok(initial.activeCount>=Object.keys(activeSaved).length,'current awarded histories unexpectedly disappeared');
   assert.deepEqual(initial.people.filter(p=>p.label!==p.expected),[]);
   assert.ok(initial.people.every(p=>!p.label.includes('旧カード')));
   assert.deepEqual(initial.former,[],'no obsolete cards may survive in live state');
   assert.equal(Object.keys(initial.current).filter(id=>!activeSet.has(id)).length,0);
   assert.equal(Object.keys(initial.snap.cards).filter(id=>!activeSet.has(id)).length,0);
   assert.equal(Object.keys(initial.backup.cards).filter(id=>!activeSet.has(id)).length,0);
   for(const [id,r] of Object.entries(activeSaved))assert.equal(initial.current[id]?.at,r.at,'current card date changed: '+id);
   await page.locator('#sengokuList .sengoku-person').filter({hasText:'立花宗茂'}).click();
   const detail=await page.locator('#sengokuDetail').textContent();
   assert.ok(!detail.includes('旧公開版・取得済みカード'),'obsolete card timeline still displayed');
   assert.ok(!detail.includes('／ 旧版'),'obsolete card content still visible');
   // Restore an older backup that contains both current and deprecated card IDs.
   const oldBackup={
    format:'walked-backup-v3',createdAt:'2024-01-01T00:00:00Z',visited:{},
    cards:{...hybrid},titles:{awards:{},selected:null}
   };
   const restored=await page.evaluate(async data=>{
     window.confirm=()=>true;
     await document.getElementById('restoreFile').onchange({
      target:{files:[{text:async()=>JSON.stringify(data)}],value:'backup.json'}
     });
     const values=JSON.parse(localStorage.getItem('walked_sengoku_cards_v1'));
     const snapshot=JSON.parse(localStorage.getItem('walked_before_restore_v1'));
     return{values,snapshot,status:document.getElementById('status').textContent,
       exported:currentBackup(),
       current:sengokuFound};
   },oldBackup);
   assert.match(restored.status,/統合しました/);
   assert.equal(Object.keys(restored.values).filter(id=>!activeSet.has(id)).length,0,'restore reintroduced legacy IDs');
   assert.equal(Object.keys(restored.snapshot.cards).filter(id=>!activeSet.has(id)).length,0);
   assert.equal(Object.keys(restored.exported.cards).filter(id=>!activeSet.has(id)).length,0);
   assert.equal(Object.keys(restored.current).filter(id=>!activeSet.has(id)).length,0);
   for(const [id,r] of Object.entries(activeSaved))assert.equal(restored.values[id]?.at,r.at,'active saved card date changed on restore');
   assert.deepEqual(errors,[]);
   console.log('C_APPROVED_CARD_ONLY_PASS',JSON.stringify({name,people:initial.people.length,current:initial.activeCount,
    removed:retired.length+1,restoredOld:0,retiredTimelineVisible:false,keptCurrentDates:true}));
  }finally{await browser.close()}
 });
}
