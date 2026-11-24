'use strict';
// Real rendering against injected local STAGING JSON. No production release or
// live data is modified. Browser navigation remains on local 127.0.0.1.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {webkit,chromium}=require('playwright');
const root=path.join(__dirname,'..');
const base='http://127.0.0.1:8765';
const fixtures=path.join(root,'.qa-assets');
const old=JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-c-20261120-new9-80.json'),'utf8'));
const stages={
 P1:JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-c-20261124-v7-phase1-staging.json'),'utf8')),
 P2:JSON.parse(fs.readFileSync(path.join(root,'sengoku/v2/approved-c-20261124-v7-phase2-staging.json'),'utf8'))
};
const NEW='sg-added-new14-asakura-soteki-20261120';
async function routeStage(page,phase){
 const staged=path.join(root,phase==='P1'?'sengoku/v2/approved-c-20261124-v7-phase1-staging.json':'sengoku/v2/approved-c-20261124-v7-phase2-staging.json');
 await page.route('**/sengoku/v2/approved-c-20261120-new9-80.json*',r=>r.fulfill({path:staged,contentType:'application/json'}));
 await page.route('**/municipalities.topojson',r=>r.fulfill({path:path.join(fixtures,'municipalities.topojson'),contentType:'application/json'}));
 await page.route('**/topojson-client@3/dist/topojson-client.min.js',r=>r.fulfill({path:path.join(fixtures,'topojson-client.min.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.js',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.js'),contentType:'application/javascript'}));
 await page.route('**/leaflet@1.9.4/dist/leaflet.css',r=>r.fulfill({path:path.join(root,'node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'}));
 await page.route('**/prefectures.topojson',r=>r.abort());
}
for(const [phase,expected] of [['P1',74],['P2',88]])
for(const [platform,browserType,options] of [
 ['iPhone WebKit',webkit,{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:3}],
 ['Desktop Chromium',chromium,{viewport:{width:1332,height:717},isMobile:false,hasTouch:false}]
]){
 test('C v7 '+phase+' staged actual browser '+platform,{timeout:150000},async()=>{
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext(options);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await routeStage(page,phase);
   await page.addInitScript(()=>{
    localStorage.setItem('walked_sengoku_cards_v1',JSON.stringify({
     'sg2hist-nobu-1534-birth':{at:'2026-11-21',basis:'approved'},
     'sg2hist-hanbei-nagashino-1575':{at:'2020-01-02',basis:'retired'},
     'sg2hist-another-unapproved':{at:'2020-01-03',basis:'unknown'}
    }));
   });
   await page.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(n=>typeof sengokuV2Catalog!=='undefined'&&
     sengokuV2Catalog?.people?.size===n,expected,{timeout:40000})
    .catch(async e=>{throw Error('Catalogue startup failed in '+phase+': '+await page.locator('#sengokuQuality').textContent().catch(()=>'(none)')+
    ' pageerrors='+errors.join('|')+' original='+e.message)});
   await page.locator('[data-collection-mode="sengoku"]').click();
   await page.waitForFunction(()=>sengokuPins.getLayers().length===419,null,{timeout:12000});
   const state=await page.evaluate(id=>{
    const newSites=[...sengokuV2Catalog.sites.values()].filter(s=>!s.publicPin);
    return {
     people:sengokuV2Catalog.people.size,
     histories:sengokuV2Catalog.histories.size,
     sites:sengokuV2Catalog.sites.size,
     publicPins:sengokuPins.getLayers().length,
     novel:sengokuV2Catalog.people.has(id),
     oldCard:sengokuFound['sg2hist-nobu-1534-birth']?.at,
     retiredCard:!!sengokuFound['sg2hist-hanbei-nagashino-1575'],
     unknownCard:!!sengokuFound['sg2hist-another-unapproved'],
     overflow:document.documentElement.scrollWidth>innerWidth+4,
     noGpsMisrepresented:newSites.some(s=>s.point&&!s.publicPin)
    };
   },NEW);
   assert.equal(state.people,expected);
   assert.equal(state.histories,stages[phase].histories.length);
   assert.equal(state.sites,stages[phase].sites.length);
   assert.equal(state.publicPins,419);
   assert.equal(state.novel,phase==='P2');
   assert.equal(state.oldCard,'2026-11-21');
   assert.equal(state.retiredCard,false);
   assert.equal(state.unknownCard,false);
   assert.equal(state.overflow,false);
   assert.equal(state.noGpsMisrepresented,false);
   // Real touch or mouse event on an existing B-approved public pin.
   // On desktop the map is resized when the collection panel opens; invalidate
   // *before* and after focus, then wait for the Leaflet SVG to be laid out.
   const focusName=options.hasTouch?'阿蘇神社':'今治城跡';
   await page.locator('#map').scrollIntoViewIfNeeded();
   await page.evaluate(name=>{
    map.invalidateSize();
    const mark=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
    if(!mark)throw Error('Existing vetted pin missing: '+name);
    map.setView(mark.getLatLng(),13,{animate:false});
   },focusName);
   await page.waitForTimeout(450);
   await page.evaluate(name=>{
    map.invalidateSize();
    const mark=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
    map.setView(mark.getLatLng(),13,{animate:false});
    mark.getElement()?.setAttribute('data-c-v7-focus','yes');
   },focusName);
   await page.waitForFunction(name=>{
    const m=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
    const e=m?.getElement(),r=e?.getBoundingClientRect();
    return !!r&&r.width>0&&r.height>0&&map.getBounds().contains(m.getLatLng());
   },focusName,{timeout:12000});
   const center=await page.evaluate(name=>{
    const m=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
    const r=m?.getElement()?.getBoundingClientRect();
    if(!r||r.width<=0||r.height<=0)throw Error('Pin SVG is not visible: '+name);
    return{x:r.left+r.width/2,y:r.top+r.height/2};
   },focusName);
   if(options.hasTouch)await page.touchscreen.tap(center.x,center.y);
   else await page.mouse.click(center.x,center.y);
   await page.waitForTimeout(250);
   const popup=await page.evaluate(()=>document.querySelector('#sengokuPinSheet .sps-scroll')?.textContent||'');
   assert.match(popup,new RegExp(focusName),'Actual tap/click must show historical pin text');
   assert.deepEqual(errors,[],'Browser execution must have no page errors');
   console.log('C_V7_BROWSER_PASS '+JSON.stringify({phase,platform,...state,popup:popup.slice(0,80)}));
  }finally{await browser.close();}
 });
}
