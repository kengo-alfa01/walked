'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {webkit,chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const base='http://127.0.0.1:8765';
const oyama='sg2site-a47-ujiteru-oyama-gion-20261121';
const oyamaHistory='sg2hist-a-ujiteru-009-20261113';
const komaki='sg2site-nobu-komakiyama';
const nagakute='sg2site-ieyasu-nagakute';
const focusHistory='sg2hist-maeda-1590-odawara';
for(const [platform,browserType,options] of [
 ['iPhone WebKit',webkit,{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}],
 ['Desktop Chromium',chromium,{viewport:{width:1332,height:717},deviceScaleFactor:1,isMobile:false,hasTouch:false}]
]){
 test('C earned/unearned visual consistency '+platform,{timeout:160000},async()=>{
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext(options),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/municipalities.topojson',r=>r.fulfill({path:path.join(root,'.qa-assets/municipalities.topojson'),contentType:'application/json'}));
  await page.route('**/topojson-client@3/dist/topojson-client.min.js',r=>r.fulfill({path:path.join(root,'.qa-assets/topojson-client.min.js'),contentType:'application/javascript'}));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
  await page.route('**/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
  await page.route('**/prefectures.topojson',r=>r.abort());
  await page.addInitScript(([h1,h2,h3])=>{
   // Reproduce a previously acquired Oyama history that predates the public pin.
   // No acquired-site ID and no Oyama visit remain in the current visit cache.
   localStorage.setItem('walked_municipal_v2',JSON.stringify({}));
   localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({
    [h1]:{at:'2026-11-20T12:00:00Z',basis:'pre-pin-card'},
    [h2]:{at:'2026-11-20T12:00:00Z',basis:'pre-pin-card'},
    [h3]:{at:'2026-11-20T12:00:00Z',basis:'pre-pin-card'}
   }));
  },[oyamaHistory,focusHistory,'sg2hist-ieyasu-1584-komaki']);
  try{
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined'&&sengokuV2Catalog?.people?.size===88,null,{timeout:45000});
   await page.locator('[data-collection-mode="sengoku"]').click();
   await page.waitForFunction(()=>sengokuPins.getLayers().length===517,null,{timeout:25000});
   const pins=await page.evaluate(([oyama,komaki,nagakute,history])=>{
    const at=(siteId)=>{
     const site=sengokuV2Catalog.sites.get(siteId);
     const halo=sengokuPinHalos.getLayers().find(h=>Math.abs(h.getLatLng().lat-site.point[1])<0.00000001&&Math.abs(h.getLatLng().lng-site.point[0])<0.00000001);
     return {siteId,hasHalo:!!halo,haloColor:halo?.options?.color,publicPin:site?.publicPin};
    };
    return {count:sengokuPins.getLayers().length,storedCard:!!sengokuFound[history],
      visitedOyama:SengokuV2.visitedCodes(state.visited).has('09208'),
      oyama:at(oyama),komaki:at(komaki),nagakute:at(nagakute)};
   },[oyama,komaki,nagakute,oyamaHistory]);
   assert.equal(pins.count,517);assert.equal(pins.storedCard,true);
   assert.equal(pins.visitedOyama,false,'fixture must reproduce missing municipality cache');
   assert.equal(pins.oyama.publicPin,true);
   assert.equal(pins.oyama.haloColor,'#151515','acquired Oyama card must have a black pin halo');
   assert.equal(pins.komaki.haloColor,'#ffffff','unvisited multi-site alternative must remain white');
   assert.equal(pins.nagakute.haloColor,'#ffffff','unvisited multi-site alternative must remain white');
   await page.locator('#sengokuSearch').fill('前田利家');
   await page.locator('#sengokuList button').filter({hasText:'前田利家'}).first().click();
   const timeline=await page.evaluate(()=>{
    const rows=[...document.querySelectorAll('#sengokuDetail .sengoku-era')].map(row=>({
      date:row.querySelector('.sengoku-year')?.textContent||'',
      owned:row.classList.contains('sengoku-era-owned'),
      tied:row.classList.contains('sengoku-chronology-tie'),
      background:getComputedStyle(row).backgroundColor,
      title:row.textContent||''
    }));
    const unearned=rows.filter(r=>r.tied&&!r.owned&&r.date.includes('1586'));
    return {unearned,earned:rows.filter(r=>r.owned),allCount:rows.length};
   });
   assert(timeline.unearned.length>=2,'expected two unearned Maeda 1586 chronology entries');
   for(const row of timeline.unearned){
    assert.equal(row.background,'rgb(246, 250, 247)','unearned chronology turned amber despite no card');
    assert.match(row.title,/未発見の足跡/);
   }
   assert(timeline.earned.some(x=>x.date.includes('1590')),'known 1590 Maeda card must stay acquired');
   assert.deepEqual(errors,[],'browser page errors');
   const directory=path.join(root,'.qa-screenshots');fs.mkdirSync(directory,{recursive:true});
   const file=path.join(directory,'c-v8-earned-visual-'+platform.replace(/[^A-Za-z]+/g,'-').toLowerCase()+'.png');
   await page.screenshot({path:file,fullPage:false});
   console.log('EARNED_VISUAL_QA_PASS '+JSON.stringify({platform,oyamaHalo:pins.oyama.haloColor,tieUnearned:timeline.unearned.length,unearnedBackground:timeline.unearned[0].background,release:'p2-88/517'}));
  }finally{await browser.close();}
 });
}
