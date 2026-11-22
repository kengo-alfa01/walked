'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webkit,chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const doc=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-c-20261120-new9-80.json'),'utf8'));
const assets=process.env.WALKED_BROWSER_ASSETS||path.join(root,'.qa-assets');
const base=process.env.WALKED_BASE_URL||'http://127.0.0.1:8765';
const saved={};
for(const r of doc.retiredHistories)saved[r.history.historyId]={at:'2020-01-02',basis:'retired'};
const firstActiveByPerson=new Set();
for(const h of doc.histories)if(!firstActiveByPerson.has(h.personId)){
 firstActiveByPerson.add(h.personId);saved[h.historyId]={at:'2024-05-06',basis:'approved'};
}
const expectedStorage=JSON.stringify(saved);
async function routes(page){
 await page.route('**/municipalities.topojson',route=>route.fulfill({path:path.join(assets,'municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',route=>route.fulfill({path:path.join(assets,'topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',route=>route.abort());
}
for(const [name,browserType,options] of [
 ['iPhone WebKit',webkit,{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}],
 ['PC Chromium',chromium,{viewport:{width:1332,height:717},deviceScaleFactor:1,isMobile:false,hasTouch:false}]
]){
 test('C obsolete count removed for all characters: '+name,{timeout:140000},async()=>{
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext({...options});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await routes(page);
  await page.addInitScript(records=>{
   localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify(records));
   localStorage.setItem('walked_municipal_v2',JSON.stringify({}));
  },saved);
  try{
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined'&&sengokuV2Catalog?.people?.size===74,null,{timeout:35000});
   await page.locator('[data-collection-mode="sengoku"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#sengokuList .sengoku-person').length>0,null,{timeout:12000});
   const result=await page.evaluate(()=>{
    const people=[...document.querySelectorAll('#sengokuList .sengoku-person')].map(b=>{
     const name=b.querySelector('strong')?.textContent||'';
     const person=sengokuPeople.find(p=>p.name===name);
     return {name,actual:b.querySelector('small')?.textContent||'',expected:countOwned(person.id)+' / '+catalogCardCount(person.id)+' 枚',
      legacy:ownedRetiredHistories(person.id).length};
    });
    const activeCount=[...sengokuV2Catalog.histories.values()].filter(h=>ownsSengokuCard(h.historyId)).length;
    const header=document.getElementById('sengokuCount').textContent;
    const oldCardRecords=[...sengokuV2Catalog.retiredHistories.values()].filter(r=>Object.prototype.hasOwnProperty.call(sengokuFound,r.history.historyId)).length;
    const storage=localStorage.getItem('walked_sengoku_cards_v1');
    const lastTotal=Object.keys(sengokuFound).length;
    renderSengoku();
    return {people,header,expectedHeader:'獲得人物 '+people.length+'人／カード '+activeCount+'枚',
      archived:oldCardRecords,current:activeCount,storageUnchanged:localStorage.getItem('walked_sengoku_cards_v1')===storage,
      savedIdsStillPresent:Object.keys(sengokuFound).length===lastTotal,
      mode:activeCollectionMode,personCount:sengokuPeople.length,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.equal(result.personCount,74);
   assert.equal(result.people.length,74,'each published character must appear when one approved card is saved');
   assert.equal(result.archived,31,'historic owned card records must still exist');
   assert.ok(result.people.some(x=>x.legacy>0),'fixture must include characters with retired cards');
   assert.deepEqual(result.people.filter(x=>x.actual!==x.expected),[],'old-card count suffix persisted');
   assert.ok(result.people.every(x=>!x.actual.includes('旧カード')));
   assert.equal(result.header,result.expectedHeader,'collection summary must show only approved current card count');
   assert.ok(!result.header.includes('旧カード'));
   assert.ok(result.storageUnchanged&&result.savedIdsStillPresent,'saved old cards were deleted or mutated');
   assert.ok(result.scrollWidth<=result.viewport+3,'layout overflow');
   const tachibana=result.people.find(x=>x.name.includes('立花宗茂'));
   assert.ok(tachibana,'Tachibana Muneshige missing');
   assert.ok(tachibana.legacy>0,'Tachibana test must include old cards');
   await page.locator('#sengokuList .sengoku-person').filter({hasText:'立花宗茂'}).click();
   const detail=await page.locator('#sengokuDetail').textContent();
   assert.ok(detail.includes('旧公開版・取得済みカード（記録を保全）'),'retired records must remain available in details');
   assert.equal(await page.evaluate(()=>Object.keys(sengokuFound).length),Object.keys(saved).length);
   assert.deepEqual(errors,[]);
   console.log('C_LEGACY_COUNT_HIDDEN_PASS',JSON.stringify({name,people:result.people.length,retiredRecords:result.archived,
      activeCards:result.current,Tachibana:{label:tachibana.actual,oldPreserved:tachibana.legacy},
      storageIntact:result.storageUnchanged,collectionHeader:result.header}));
  }finally{await browser.close();}
 });
}
