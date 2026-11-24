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
    // Related-only site: 鹿角市 should collect 長牛館 without needing a site GPS.
    localStorage.setItem('walked_municipal_v2',JSON.stringify({'05209':{first:'2026-11-24',last:'2026-11-24'}}));
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
   await page.waitForFunction(n=>sengokuPins.getLayers().length===n,phase==='P1'?454:486,{timeout:12000});
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
   assert.equal(state.publicPins,phase==='P1'?454:486);
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
   assert.match(popup,new RegExp(focusName==='今治城跡'?'今治城':focusName),'Actual tap/click must show historical pin text');
   // Independently approved newly published Phase1 position: perform an actual
   // tap/click, verify historical prose, color/caution and required source credit.
   // The older popup is closed through the same user-facing × control.
   await page.locator('#sengokuPinSheet .sps-close').click();
   const newPinName='富山城跡';
   await page.evaluate(name=>{
    map.invalidateSize();
    const mark=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
    if(!mark)throw Error('New Phase1 pin missing: '+name);
    map.setView(mark.getLatLng(),13,{animate:false});
   },newPinName);
   await page.waitForTimeout(450);
   await page.evaluate(name=>{
    map.invalidateSize();
    const mark=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
    map.setView(mark.getLatLng(),13,{animate:false});
   },newPinName);
   await page.waitForFunction(name=>{
    const m=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
    const r=m?.getElement()?.getBoundingClientRect();
    return !!r&&r.width>0&&r.height>0&&map.getBounds().contains(m.getLatLng());
   },newPinName,{timeout:12000});
   const fresh=await page.evaluate(name=>{
    const m=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
    const r=m.getElement()?.getBoundingClientRect();
    if(!r)throw Error('New pin not visible');
    return{x:r.left+r.width/2,y:r.top+r.height/2};
   },newPinName);
   if(options.hasTouch)await page.touchscreen.tap(fresh.x,fresh.y);
   else await page.mouse.click(fresh.x,fresh.y);
   await page.waitForTimeout(250);
   const newText=await page.evaluate(()=>{
    const s=sengokuV2Catalog.sites.get('sg2site-a2post-toyama-castle-20261118');
    return{
     popup:document.querySelector('#sengokuPinSheet .sps-scroll')?.textContent||'',
     publicPin:s?.publicPin,
     access:s?.pinReview?.accessStatus,
     attrs:s?.pinReview?.attributions?.length,
     heldPublic:sengokuV2Catalog.sites.get('sg2site-a5-kita-mise-yakata-20261121')?.publicPin,
     heldPoint:sengokuV2Catalog.sites.get('sg2site-a5-kita-mise-yakata-20261121')?.point
    };
   });
   assert.equal(newText.publicPin,true);
   assert.equal(newText.access,'green');
   assert(newText.attrs>=2);
   assert.match(newText.popup,/富山城/,'New pin must display its historical prose');
   assert.match(newText.popup,/出典・ライセンス帰属/,'New pin must show source license');
   assert.match(newText.popup,/CODH/,'CODH attribution must be visible');
   assert.equal(newText.heldPublic,false,'B denied site must not become a map marker');
   assert.equal(newText.heldPoint,null,'B denied site GPS must remain suppressed');
   if(phase==='P2'){
    // Phase2 must include 32 independently B and ⑥ approved new site pins,
    // but never publish the conditional private Hachijo residence GPS.
    const safety=await page.evaluate(()=>{
     const s=sengokuV2Catalog.sites.get('sg2site-new14-gamou-matsusaka-20261120');
     const privateSite=sengokuV2Catalog.sites.get('sg2site-a-hachijo-hideie-residence-20261123');
     return {added:s?.publicPin===true,point:s?.point,credits:s?.pinReview?.attributions?.map(x=>x.label),
       privateSitePublic:privateSite?.publicPin,privatePoint:privateSite?.point,
       newerSites:[...sengokuV2Catalog.sites.values()].filter(x=>x.publicPin&&
        x.approval?.sheetRow>=3909&&x.approval?.sheetRow<=4445).length};
    });
    assert.equal(safety.added,true);
    assert(Array.isArray(safety.point)&&safety.point.length===2);
    assert(safety.credits?.some(x=>x.includes('CODH')),'Phase2 licensed POI missing CODH credit');
    assert.equal(safety.privateSitePublic,false);
    assert.equal(safety.privatePoint,null,'Private Hachijo home GPS must stay suppressed');
    await page.locator('#sengokuPinSheet .sps-close').click();
    const newName='松坂城跡';
    await page.locator('#map').scrollIntoViewIfNeeded();
    await page.evaluate(name=>{
     map.invalidateSize();
     const marker=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
     if(!marker)throw Error('P2 vetted pin missing: '+name);
     map.setView(marker.getLatLng(),13,{animate:false});
    },newName);
    await page.waitForTimeout(450);
    await page.evaluate(name=>{
     map.invalidateSize();
     const marker=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
     map.setView(marker.getLatLng(),13,{animate:false});
    },newName);
    await page.waitForFunction(name=>{
     const marker=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
     const box=marker?.getElement()?.getBoundingClientRect();
     return box&&box.width>0&&box.height>0&&map.getBounds().contains(marker.getLatLng());
    },newName,{timeout:12000});
    const pos=await page.evaluate(name=>{
     const marker=sengokuPins.getLayers().find(m=>m.getPopup()?.getContent()?.textContent?.includes(name));
     const box=marker.getElement().getBoundingClientRect();
     return{x:box.left+box.width/2,y:box.top+box.height/2};
    },newName);
    if(options.hasTouch)await page.touchscreen.tap(pos.x,pos.y);
    else await page.mouse.click(pos.x,pos.y);
    await page.waitForTimeout(250);
    const body=await page.evaluate(()=>document.querySelector('#sengokuPinSheet .sps-scroll')?.textContent||'');
    assert.match(body,/松坂城|松阪城/,'Phase2 real touch/click must show Matsusaka Castle text');
    assert.match(body,/CODH/,'Phase2 POI attribution must be visible');
   }
   // A separate B-approved related site must be acquired from a municipal visit
   // even though no ④ direct event-card link or public GPS exists.
   const relatedCount=await page.evaluate(()=>{
    const pid='sg-added-nanbu-harumasa-20261114';
    return {
     hits:SengokuV2.collectedRelatedSites(sengokuV2Catalog,state.visited,pid).map(e=>e.siteId),
     visited:SengokuV2.visitedCodes(state.visited).has('05209'),
     storyUnlocked:SengokuV2.canUnlockStory(sengokuV2Catalog,pid,sengokuFound,PublicationRuntime.sha256),
     relatedSite:sengokuV2Catalog.sites.get('sg2site-a6-nanbu-nagau-20261121')
    };
   });
   assert.equal(relatedCount.visited,true);
   assert(relatedCount.hits.includes('sg2site-a6-nanbu-nagau-20261121'));
   assert.equal(relatedCount.relatedSite.publicPin,false);
   assert.equal(relatedCount.relatedSite.point,null);
   // Clicking a character with related sites must show them *after* the
   // history and biography sections, without changing event-card counts.
   await page.locator('#sengokuPinSheet .sps-close').click();
   await page.locator('#sengokuSearch').fill('南部晴政');
   await page.locator('#sengokuList button').first().click();
   const siteDetail=await page.locator('#sengokuDetail').textContent();
   assert.match(siteDetail,/関連史跡/,'Related site section must exist');
   assert.match(siteDetail,/長牛館跡/,'Municipal-only B-approved site must appear');
   assert.match(siteDetail,/史跡獲得済み/,'Collected site must be marked');
   assert(siteDetail.lastIndexOf('関連史跡')>siteDetail.indexOf('完成版ストーリー'),
    'Related sites must follow lifetime card/story section');
   assert(!relatedCount.storyUnlocked,'Related-only site cannot auto-unlock all historical event cards');

   assert.deepEqual(errors,[],'Browser execution must have no page errors');
   console.log('C_V7_BROWSER_PASS '+JSON.stringify({phase,platform,...state,popup:popup.slice(0,80)}));
  }finally{await browser.close();}
 });
}
