'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webkit,chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),base=process.env.WALKED_BASE_URL||'http://127.0.0.1:8765';
const assets=process.env.WALKED_BROWSER_ASSETS||path.join(root,'.qa-assets');
async function routeAssets(page){
 await page.route('**/municipalities.topojson',route=>route.fulfill({path:path.join(assets,'municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',route=>route.fulfill({path:path.join(assets,'topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',route=>route.abort());
}
for(const [name,browserType,options] of [
 ['iPhone WebKit tap',webkit,{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}],
 ['PC Chromium click',chromium,{viewport:{width:1366,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}]
]){
 test('C ⑥v2 approved16 419-pin browser QA '+name,{timeout:160000},async()=>{
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext({...options});
  const page=await context.newPage(),issues=[];
  page.on('pageerror',e=>issues.push(e.message));await routeAssets(page);
  await page.addInitScript(()=>{
   localStorage.setItem('walked_municipal_v2',JSON.stringify({'25201':{first:'2020-01-01',last:'2020-01-01'}}));
   localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({'sg2hist-nobuyuki-1620-komatsu':{at:'2020-01-02',basis:'old-version'}}));
  });
  try{
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined'&&sengokuV2Catalog?.people?.size===74,null,{timeout:35000});
   await page.locator('[data-collection-mode="sengoku"]').click();
   const report=await page.evaluate(()=>{
    const pins=[...sengokuV2Catalog.sites.values()].filter(s=>s.publicPin&&Array.isArray(s.point));
    const markers=sengokuPins.getLayers(),approved=SengokuPinApprovedV2;
    let structured=0,legacy=0,historyMissing=0,approvedLeaks=0,legacySafetyLost=0,wrongColors=0,creditsMissing=0,officialMismatch=0;
    for(const [i,site] of pins.entries()){
     const marker=markers[i],content=marker?.getPopup()?.getContent();
     if(!marker||!content){historyMissing++;continue}
     const text=content.textContent,a=approved[site.siteId],expectedHistory=a?.historyText||site.description;
     if(!text.includes(site.name)||!text.includes(expectedHistory))historyMissing++;
     if(marker.options.fillColor!==SengokuV2.pinPresentation(SengokuPinDisplay.statusFor(site,approved)).fill)wrongColors++;
     if(a){
      structured++;
      if(text.includes('【③史跡!')||text.includes('【管理用・非表示')||text.includes('【出典・利用】')||text.includes('100m接近による獲得判定'))approvedLeaks++;
      if(!text.includes(a.notice)||!text.includes(a.attributions[0].label)||!text.includes('CC BY 4.0'))creditsMissing++;
      const links=[...content.querySelectorAll('a')].map(x=>x.getAttribute('href'));
      const expectedLinks=[...(a.officialInfoUrl?[a.officialInfoUrl]:[]),...a.attributions.map(x=>x.url)];
      if(JSON.stringify(links)!==JSON.stringify(expectedLinks))officialMismatch++;
     }else{
      legacy++;
      if(!text.includes(site.pinReview.restriction))legacySafetyLost++;
     }
    }
    const toramaru= pins.find(s=>s.siteId==='sg2site-new9-sweep-sogo-toramaru-20261120');
    const oldCard=sengokuFound['sg2hist-nobuyuki-1620-komatsu']?.at;
    const h=[...sengokuV2Catalog.histories.values()].find(h=>(h.sourceUrls||[]).filter(SengokuSourceLinks.validSourceUrl).length>=3);
    if(!h)throw Error('No 3-link history');
    sengokuFound[h.historyId]={at:'2026-11-22',basis:'qa'};
    showSengokuPerson(sengokuPeople.find(p=>p.id===h.personId));
    const expected=h.sourceUrls.filter(SengokuSourceLinks.validSourceUrl);
    const group=[...document.querySelectorAll('#sengokuDetail .sengoku-source-links')].find(g=>JSON.stringify([...g.querySelectorAll('a')].map(a=>a.getAttribute('href')))===JSON.stringify(expected));
    if(!group)throw Error('source group not visible');
    group.setAttribute('data-qa-3links','yes');
    // Restoring all-person pins after opening the earned card keeps source DOM visible.
    selectedSengokuPersonId=null;refreshSengokuPins();
    return{pins:pins.length,markers:markers.length,structured,legacy,historyMissing,approvedLeaks,legacySafetyLost,wrongColors,creditsMissing,officialMismatch,
      toramaruLegacyStatus:toramaru.pinReview.accessStatus,toramaruLiveStatus:SengokuPinDisplay.statusFor(toramaru,approved),
      oldCard,historyLinks:expected.length,historyRendered:group.textContent,viewport:innerWidth,pageWidth:document.documentElement.scrollWidth};
   });
   assert.equal(report.pins,419);assert.equal(report.markers,419);
   assert.equal(report.structured,16);assert.equal(report.legacy,403);
   for(const k of ['historyMissing','approvedLeaks','legacySafetyLost','wrongColors','creditsMissing','officialMismatch'])assert.equal(report[k],0,k);
   assert.equal(report.toramaruLegacyStatus,'red');assert.equal(report.toramaruLiveStatus,'yellow');
   assert.equal(report.oldCard,'2020-01-02');
   assert.equal(report.historyRendered,Array(report.historyLinks).fill('出典を読む').join(' / '));
   assert.ok(report.pageWidth<=report.viewport+3,'screen overflow '+JSON.stringify(report));
   // Real approved pin tap/click on the map after async municipality initialization.
   await page.evaluate(()=>{
    const m=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
    if(!m)throw Error('No approved Aso pin');
    map.setView(m.getLatLng(),13,{animate:false});
   });
   await page.locator('#map').scrollIntoViewIfNeeded();await page.waitForTimeout(430);
   await page.evaluate(()=>{
    map.invalidateSize();
    const m=sengokuPins.getLayers().find(x=>x.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
    map.setView(m.getLatLng(),13,{animate:false});
    m.getElement().setAttribute('data-qa-aso','yes');
   });
   await page.waitForFunction(()=>{
    const m=sengokuPins.getLayers().find(x=>x.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
    return map.getBounds().contains(m.getLatLng())&&m.getElement()?.getAttribute('d')!=='M0 0';
   },null,{timeout:10000});
   if(options.hasTouch){
    const box=await page.locator('[data-qa-aso="yes"]').boundingBox();
    if(!box)throw Error('Aso SVG not visible');
    await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
   }else await page.locator('[data-qa-aso="yes"]').click({timeout:10000});
   await page.waitForTimeout(250);
   const popupText=await page.evaluate(mobile=>mobile?document.querySelector('#sengokuPinSheet .sps-scroll')?.textContent||'':map._popup?.getContent()?.textContent||'',options.hasTouch);
   assert.match(popupText,/阿蘇神社/);assert.match(popupText,/見学上の注意/);assert.match(popupText,/CODH作成/);
   assert.equal(popupText.includes('【管理用・非表示'),false);
   const link=page.locator('[data-qa-3links="yes"] a').first();
   await link.scrollIntoViewIfNeeded();
   const pop=page.waitForEvent('popup',{timeout:12000});
   if(options.hasTouch){const b=await link.boundingBox();if(!b)throw Error('source anchor hidden');await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2)}
   else await link.click({timeout:10000});
   const opened=await pop;await opened.close();
   assert.deepEqual(issues,[]);
   console.log('C_APPROVED16_BROWSER_PASS',JSON.stringify({name,report,pinRealClick:true,sourceRealClick:true,popupText:popupText.slice(0,120)}));
  }finally{await browser.close()}
 });
}
