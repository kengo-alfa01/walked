'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webkit,chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),base=process.env.WALKED_BASE_URL||'http://127.0.0.1:8765';
const assets=process.env.WALKED_BROWSER_ASSETS||path.join(root,'.qa-assets');
const release=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-c-20261120-new9-80.json'),'utf8'));
const pinId='sg2site-new9-aso-shrine-20261119';
async function routeAssets(page){
 await page.route('**/municipalities.topojson',route=>route.fulfill({path:path.join(assets,'municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',route=>route.fulfill({path:path.join(assets,'topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',route=>route.abort());
}
for(const [name,browserType,options] of [
 ['WebKit iPhone touch',webkit,{viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true}],
 ['Chromium desktop',chromium,{viewport:{width:1366,height:900},deviceScaleFactor:1,isMobile:false,hasTouch:false}]
]){
 test('C 20261120 browser QA: '+name,{timeout:140000},async()=>{
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext({...options,acceptDownloads:true});
  const page=await context.newPage();
  const issues=[];
  page.on('pageerror',e=>issues.push(e.message));
  context.on('dialog',d=>d.accept());
  await routeAssets(page);
  await page.addInitScript(()=>{
   localStorage.setItem('walked_municipal_v2',JSON.stringify({'25201':{first:'2020-01-01',last:'2020-01-01'}}));
   localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({'sg2hist-nobu-1534-birth':{at:'2020-01-01',basis:'old-saved'},'sg2hist-nobuyuki-1620-komatsu':{at:'2020-01-02',basis:'old-version'}}));
  });
  try{
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined' && sengokuV2Catalog?.people?.size===74 && sengokuV2Catalog?.histories?.size===1251,null,{timeout:30000}).catch(async e=>{
     const msg=await page.locator('#sengokuQuality').textContent().catch(()=>null);
     throw new Error('C catalog startup failed: '+msg+'; '+issues.slice(-3).join('; '));
   });
   await page.locator('[data-collection-mode="sengoku"]').click();
   await page.waitForTimeout(180);
   const state=await page.evaluate(()=>{
     const ids=[...sengokuV2Catalog.retiredHistories.keys()];
     const marker=sengokuPins.getLayers().find(x=>x.options.siteId==='sg2site-new9-aso-shrine-20261119'
       ||x.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
     return {
       catalogPeople:sengokuV2Catalog.people.size,
       histories:sengokuV2Catalog.histories.size,
       sites:sengokuV2Catalog.sites.size,
       publicPins:sengokuPins.getLayers().length,
       archived:sengokuV2Catalog.retiredHistories.size,
       oldOwned:sengokuFound['sg2hist-nobuyuki-1620-komatsu']?.at,
       oldOwnedStable:!!sengokuFound['sg2hist-nobu-1534-birth'],
       newSiteStatus:sengokuV2Catalog.sites.get('sg2site-new9-aso-shrine-20261119')?.pinReview?.accessStatus,
       markerExists:!!marker,
       latestHistoricalPinStatus:sengokuV2Catalog.sites.get('sg2site-a-sorin-funai-residence-20261114')?.pinReview?.accessStatus,
       newMunicipalityAward:sengokuV2Catalog.municipalityAwards?.size,
       width:document.documentElement.scrollWidth,viewport:innerWidth
     };
   });
   assert.equal(state.catalogPeople,74);assert.equal(state.histories,1251);assert.equal(state.sites,436);
   assert.equal(state.publicPins,419);assert.equal(state.archived,31);
   assert.equal(state.oldOwned,'2020-01-02');assert.equal(state.oldOwnedStable,true);
   assert.equal(state.newSiteStatus,'green');assert.equal(state.markerExists,true);
   assert.equal(state.latestHistoricalPinStatus,'red');assert.equal(state.newMunicipalityAward,6);
   
   assert.ok(state.width<=state.viewport+3,'responsive layout overflow '+JSON.stringify(state));
   await page.evaluate(()=>{
     const marker=sengokuPins.getLayers().find(x=>x.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
     if(!marker)throw Error('C approved pin missing on map');
     map.setView(marker.getLatLng(),13,{animate:false});
   });
   await page.locator('#map').scrollIntoViewIfNeeded();
   await page.waitForTimeout(450);
   let center=await page.evaluate(()=>{
     map.invalidateSize();
     const m=sengokuPins.getLayers().find(x=>x.getPopup()?.getContent()?.textContent?.includes('阿蘇神社'));
     const r=m.getElement()?.getBoundingClientRect();
     if(!r)throw Error('approved pin SVG cannot be located');
     return{x:r.left+r.width/2,y:r.top+r.height/2};
   });
   if(options.hasTouch)await page.touchscreen.tap(center.x,center.y);
   else await page.mouse.click(center.x,center.y);
   await page.waitForTimeout(280);
   let popup=await page.evaluate(()=>document.querySelector('#sengokuPinSheet .sps-scroll')?.textContent||'');
   assert.match(popup,/阿蘇神社/,'real pin click/tap must show approved description');
   const buttonState=await page.evaluate(()=>({
     hiddenBackground:getComputedStyle(document.querySelector('.map-display-controls')).display==='none',
     hiddenCurrent:getComputedStyle(document.querySelector('.map-center')).display==='none',
     oldOwned:sengokuFound['sg2hist-nobuyuki-1620-komatsu'].at
   }));
   assert.equal(buttonState.hiddenBackground,true);assert.equal(buttonState.hiddenCurrent,true);
   assert.equal(buttonState.oldOwned,'2020-01-02');
   assert.deepEqual(issues,[],'no script page exceptions');
   console.log('C_20261120_BROWSER_PASS',JSON.stringify({name,...state,popup:popup.slice(0,140),buttonState}));
  }finally{await browser.close();}
 });
}
