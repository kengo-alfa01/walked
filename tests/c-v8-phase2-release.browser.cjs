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
   localStorage.setItem('walked_municipal_v2',JSON.stringify({}));
   localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({
    "sg2hist-katsuyori-1562-takato":{at:'2020-01-01',basis:'approved'},
    'sg2hist-nobu-1534-birth':{at:'2026-11-22',basis:'approved'},
    'sg2hist-hanbei-nagashino-1575':{at:'2020-01-02',basis:'retired'}
   }));
  });
  try{
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>typeof sengokuV2Catalog!=='undefined'&&sengokuV2Catalog?.people?.size===88,{timeout:45000});
   await page.locator('[data-collection-mode="sengoku"]').click();
   await page.waitForFunction(()=>sengokuPins.getLayers().length===522,{timeout:20000});
   const actual=await page.evaluate(()=>{
    const p1=sengokuV2Catalog.sites.get('sg2site-a5-kita-mise-yakata-20261121');
    const restored=sengokuV2Catalog.sites.get('sg2site-a27-ujitsuna-taisekiji-1537-20261121');
    const red=sengokuV2Catalog.sites.get('sg2site-a6-nanbu-nagau-20261121');
    return {version:sengokuV2Catalog.version,people:sengokuV2Catalog.people.size,
     pins:sengokuPins.getLayers().length,visible:p1?.publicPin,
     p1Point:p1?.point,p1Access:p1?.pinReview?.accessStatus,
     redNoRouting:red?SengokuV2.pinDetails(red).noRouting:null,
     restoredPin:restored?.publicPin,restoredPoint:restored?.point,blockedOldSite:sengokuV2Catalog.sites.has('sg2site-a-katsuyori-tano-20261111'),blockedKatsuyoriHistory:sengokuV2Catalog.histories.has('sg2hist-katsuyori-1582-death'),
     phase2SitePresent:sengokuV2Catalog.sites.has('sg2site-a34-naoie-otogo-20261121'),
     phase2PersonPresent:sengokuV2Catalog.people.has('sg-master-0344'),
     phase2SitePublic:sengokuV2Catalog.sites.get('sg2site-a34-naoie-otogo-20261121')?.publicPin,
     phase2SitePoint:sengokuV2Catalog.sites.get('sg2site-a34-naoie-otogo-20261121')?.point,
     hachijoRedNoRouting:SengokuV2.pinDetails(sengokuV2Catalog.sites.get('sg2site-a-hachijo-hideie-residence-20261123')).noRouting,
     validOldHistory:!!sengokuFound['sg2hist-nobu-1534-birth'],
     retiredOldHistory:!!sengokuFound['sg2hist-hanbei-nagashino-1575'],
     overflow:document.documentElement.scrollWidth>window.innerWidth+4};
   });
   assert.equal(actual.version,'v2-approved-c-20261124-p2-88-v10');
   assert.deepEqual([actual.people,actual.pins],[88,522]);
   assert.equal(actual.visible,true);assert.deepEqual(actual.p1Point,[136.4188125,34.4061875]);
   assert.equal(actual.p1Access,'yellow');assert.equal(actual.redNoRouting,true);
   assert.equal(actual.restoredPin,true);assert.deepEqual(actual.restoredPoint,[138.583466,35.281353]);assert.equal(actual.blockedOldSite,true);assert.equal(actual.blockedKatsuyoriHistory,true);
   assert.equal(actual.phase2SitePresent,true);assert.equal(actual.phase2PersonPresent,true);
   assert.equal(actual.phase2SitePublic,true);
   assert.deepEqual(actual.phase2SitePoint,[134.039537,34.630544]);
   assert.equal(actual.hachijoRedNoRouting,true);
   assert.equal(actual.validOldHistory,true);assert.equal(actual.retiredOldHistory,false);
   assert.equal(actual.overflow,false);assert.deepEqual(errors,[]);
   assert.equal(seen.length,1,'Must load release data exactly once');
   assert.equal(seen[0].status,200);
   // Target-specific actual DOM, Leaflet layers and acquisition path; no intercepted release JSON.
   const target=await page.evaluate(()=>{
    const s=sengokuV2Catalog.sites.get('sg2site-a-katsuyori-tano-20261111');
    const id='sg2hist-katsuyori-1582-death';
    const at=layer=>Math.abs(layer.getLatLng().lat-s.point[1])<1e-9&&Math.abs(layer.getLatLng().lng-s.point[0])<1e-9;
    const marker=sengokuPins.getLayers().find(at),halo=sengokuPinHalos.getLayers().find(at);
    const expected=SengokuV2.pinPresentation('yellow');
    marker.fire('click');
    return {marker:!!marker,fill:marker.options.fillColor,expected:expected.fill,halo:halo.options.color,owned:ownsSengokuCard(id),sheet:document.querySelector('#sengokuPinSheet').textContent};
   });
   assert(target.marker);assert.equal(target.fill,target.expected);assert.equal(target.halo,'#ffffff');assert.equal(target.owned,false);
   assert.match(target.sheet,/生害石/);assert.match(target.sheet,/100m接近は不要/);assert.match(target.sheet,/黄/);
   await page.evaluate(()=>sitePinSheet.close());
   await page.locator('#sengokuSearch').fill('武田勝頼');
   await page.locator('#sengokuList button').filter({hasText:'武田勝頼'}).first().click();
   const locked=await page.evaluate(()=>[...document.querySelectorAll('#sengokuDetail .sengoku-era')].find(row=>row.querySelector('.sengoku-year')?.textContent==='天正10年（1582）旧暦3月11日')?.textContent);
   assert.match(locked||'',/未発見の足跡/);
   const acquired=await page.evaluate(()=>{
    const id='sg2hist-katsuyori-1582-death';
    state.visited['19213']={first:'2020-01-01'};
    reconcileSengokuVisits();
    const first=JSON.stringify(sengokuFound[id]);
    reconcileSengokuVisits();
    showSengokuPerson({id:'sg-e00b2631eded',name:'武田勝頼'});
    const rows=[...document.querySelectorAll('#sengokuDetail .sengoku-era-owned')].filter(row=>row.querySelector('.sengoku-card-title')?.textContent==='甲斐田野で自害し武田宗家が滅亡する');
    const s=sengokuV2Catalog.sites.get('sg2site-a-katsuyori-tano-20261111');
    const halo=sengokuPinHalos.getLayers().find(layer=>Math.abs(layer.getLatLng().lat-s.point[1])<1e-9&&Math.abs(layer.getLatLng().lng-s.point[0])<1e-9);
    return {owned:ownsSengokuCard(id),same:!!first&&first===JSON.stringify(sengokuFound[id]),cardCount:rows.length,cardText:rows[0]?.textContent,halo:halo?.options.color,overflow:document.documentElement.scrollWidth>window.innerWidth+4};
   });
   assert(acquired.owned);assert(acquired.same);assert.equal(acquired.cardCount,1);assert.match(acquired.cardText,/獲得済み/);assert.equal(acquired.halo,'#151515');assert.equal(acquired.overflow,false);assert.deepEqual(errors,[]);
   console.log('KATSUYORI_TANO_TARGET_BROWSER_PASS '+label);

   console.log('P1_BROWSER_RELEASE_PASS '+label+' '+JSON.stringify({version:actual.version,people:88,pins:522}));
  }finally{await browser.close();}
 });
}
