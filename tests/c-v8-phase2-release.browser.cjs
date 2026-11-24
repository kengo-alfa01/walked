'use strict';
// Production-pointer smoke: do not intercept Sengoku JSON. Verify the page loads
// the exact Phase2 release artifact from its real path and never exposes Phase2.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {webkit,chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const base='http://127.0.0.1:8765';
for(const [label,browserType,opts] of [
 ['iPhone WebKit',webkit,{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3}],
 ['Desktop Chromium',chromium,{viewport:{width:1332,height:717}}]
]){
 test('Phase2 actual release pointer '+label,{timeout:140000},async()=>{
  const browser=await browserType.launch({headless:true});
  const ctx=await browser.newContext(opts),page=await ctx.newPage();
  const errors=[],seen=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('approved-c-20261124-p2-88.json'))seen.push({status:r.status(),url:r.url()});});
  await page.route('**/municipalities.topojson',r=>r.fulfill({path:path.join(root,'.qa-assets/municipalities.topojson'),contentType:'application/json'}));
  await page.route('**/topojson-client@3/dist/topojson-client.min.js',r=>r.fulfill({path:path.join(root,'.qa-assets/topojson-client.min.js'),contentType:'application/javascript'}));
  await page.route('**/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
  await page.route('**/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
  await page.route('**/prefectures.topojson',r=>r.abort());
  await page.addInitScript(()=>{
   localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({
    'sg2hist-nobu-1534-birth':{at:'2026-11-22',basis:'approved'},
    'sg2hist-hanbei-nagashino-1575':{at:'2020-01-02',basis:'retired'}
   }));
  });
  try{
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined'&&sengokuV2Catalog?.people?.size===88,{timeout:45000});
   await page.locator('[data-collection-mode="sengoku"]').click();
   await page.waitForFunction(()=>sengokuPins.getLayers().length===517,{timeout:20000});
   const actual=await page.evaluate(()=>{
    const p1=sengokuV2Catalog.sites.get('sg2site-a5-kita-mise-yakata-20261121');
    const blocked=sengokuV2Catalog.sites.get('sg2site-a27-ujitsuna-taisekiji-1537-20261121');
    const red=sengokuV2Catalog.sites.get('sg2site-a6-nanbu-nagau-20261121');
    return {version:sengokuV2Catalog.version,people:sengokuV2Catalog.people.size,
     pins:sengokuPins.getLayers().length,visible:p1?.publicPin,
     p1Point:p1?.point,p1Access:p1?.pinReview?.accessStatus,
     redNoRouting:red?SengokuV2.pinDetails(red).noRouting:null,
     withheld:blocked?.publicPin,withheldPoint:blocked?.point,
     phase2SitePresent:sengokuV2Catalog.sites.has('sg2site-a34-naoie-otogo-20261121'),
     phase2PersonPresent:sengokuV2Catalog.people.has('sg-master-0344'),
     phase2SitePublic:sengokuV2Catalog.sites.get('sg2site-a34-naoie-otogo-20261121')?.publicPin,
     phase2SitePoint:sengokuV2Catalog.sites.get('sg2site-a34-naoie-otogo-20261121')?.point,
     hachijoRedNoRouting:SengokuV2.pinDetails(sengokuV2Catalog.sites.get('sg2site-a-hachijo-hideie-residence-20261123')).noRouting,
     validOldHistory:!!sengokuFound['sg2hist-nobu-1534-birth'],
     retiredOldHistory:!!sengokuFound['sg2hist-hanbei-nagashino-1575'],
     overflow:document.documentElement.scrollWidth>window.innerWidth+4};
   });
   assert.equal(actual.version,'v2-approved-c-20261124-p2-88');
   assert.deepEqual([actual.people,actual.pins],[88,517]);
   assert.equal(actual.visible,true);assert.deepEqual(actual.p1Point,[136.4188125,34.4061875]);
   assert.equal(actual.p1Access,'yellow');assert.equal(actual.redNoRouting,true);
   assert.equal(actual.withheld,false);assert.equal(actual.withheldPoint,null);
   assert.equal(actual.phase2SitePresent,true);assert.equal(actual.phase2PersonPresent,true);
   assert.equal(actual.phase2SitePublic,true);
   assert.deepEqual(actual.phase2SitePoint,[134.039537,34.630544]);
   assert.equal(actual.hachijoRedNoRouting,true);
   assert.equal(actual.validOldHistory,true);assert.equal(actual.retiredOldHistory,false);
   assert.equal(actual.overflow,false);assert.deepEqual(errors,[]);
   assert.equal(seen.length,1,'Must load release data exactly once');
   assert.equal(seen[0].status,200);
   console.log('P1_BROWSER_RELEASE_PASS '+label+' '+JSON.stringify({version:actual.version,people:88,pins:517}));
  }finally{await browser.close();}
 });
}
